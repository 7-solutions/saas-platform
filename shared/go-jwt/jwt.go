package jwtlib

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Keypair struct {
	Private *rsa.PrivateKey
	Public  *rsa.PublicKey
	KID     string
}

type Claims struct {
	Subject string   `json:"sub"`
	Email   string   `json:"email,omitempty"`
	Roles   []string `json:"roles,omitempty"`
	jwt.RegisteredClaims
}

func LoadOrGenerate() (*Keypair, error) {
	// Prefer environment variables for PEM
	privPEM := os.Getenv("JWT_PRIVATE_PEM")
	pubPEM := os.Getenv("JWT_PUBLIC_PEM")
	kid := os.Getenv("JWT_KID")
	if privPEM != "" && pubPEM != "" {
		priv, err := parseRSAPrivateFromPEM([]byte(privPEM))
		if err != nil {
			return nil, err
		}
		pub, err := parseRSAPublicFromPEM([]byte(pubPEM))
		if err != nil {
			return nil, err
		}
		if kid == "" {
			kid = "default"
		}
		return &Keypair{Private: priv, Public: pub, KID: kid}, nil
	}
	// Fallback: generate ephemeral pair for dev
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	if kid == "" {
		kid = "ephemeral"
	}
	return &Keypair{Private: key, Public: &key.PublicKey, KID: kid}, nil
}

func parseRSAPrivateFromPEM(b []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(b)
	if block == nil {
		return nil, errors.New("invalid private pem")
	}
	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		rk, ok := k.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("not rsa private key")
		}
		return rk, nil
	default:
		return nil, errors.New("unsupported private key type")
	}
}

func parseRSAPublicFromPEM(b []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(b)
	if block == nil {
		return nil, errors.New("invalid public pem")
	}
	switch block.Type {
	case "PUBLIC KEY":
		pub, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		rk, ok := pub.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("not rsa public key")
		}
		return rk, nil
	case "RSA PUBLIC KEY":
		return x509.ParsePKCS1PublicKey(block.Bytes)
	default:
		return nil, errors.New("unsupported public key type")
	}
}

func (kp *Keypair) Issue(sub, email string, roles []string, issuer string, ttl time.Duration) (string, error) {
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, &Claims{
		Subject: sub,
		Email:   email,
		Roles:   roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   sub,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	})
	if kp.KID != "" {
		token.Header["kid"] = kp.KID
	}
	return token.SignedString(kp.Private)
}

func (kp *Keypair) ParseVerify(tokenStr string, aud, iss string) (*Claims, error) {
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Name}))
	claims := &Claims{}
	_, err := parser.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return kp.Public, nil
	})
	if err != nil {
		return nil, err
	}
	if iss != "" && claims.Issuer != iss {
		return nil, errors.New("issuer mismatch")
	}
	if aud != "" {
		if !contains(claims.Audience, aud) {
			return nil, errors.New("audience mismatch")
		}
	}
	return claims, nil
}

func contains(a jwt.ClaimStrings, v string) bool {
	for _, s := range a {
		if s == v {
			return true
		}
	}
	return false
}

// JWKS returns a minimal JWKS JSON for RS256 single key
func (kp *Keypair) JWKS() ([]byte, error) {
	n := kp.Public.N.Bytes()
	e := kp.Public.E

	jwk := map[string]any{
		"keys": []map[string]any{
			{
				"kty": "RSA",
				"kid": kp.KID,
				"use": "sig",
				"alg": "RS256",
				"n":   base64url(n),
				"e":   base64urlFromInt(e),
			},
		},
	}
	return json.Marshal(jwk)
}

func base64url(b []byte) string {
	const encodeURL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	// Simple base64url without padding
	s := make([]byte, 0, (len(b)+2)/3*4)
	var val uint
	var valb int
	for _, c := range b {
		val = (val << 8) | uint(c)
		valb += 8
		for valb >= 6 {
			s = append(s, encodeURL[(val>>(uint(valb-6)))&0x3F])
			valb -= 6
		}
	}
	if valb > 0 {
		s = append(s, encodeURL[(val<<(uint(6-valb)))&0x3F])
	}
	return string(s)
}

func base64urlFromInt(i int) string {
	// public exponent is small; represent as big-endian bytes
	if i == 0 {
		return base64url([]byte{0})
	}
	var b []byte
	for v := i; v > 0; v >>= 8 {
		b = append([]byte{byte(v & 0xFF)}, b...)
	}
	return base64url(b)
}

// ExtractBearer returns the bearer token from Authorization header.
func ExtractBearer(r *http.Request) (string, error) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", errors.New("missing authorization")
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", errors.New("invalid authorization")
	}
	return parts[1], nil
}