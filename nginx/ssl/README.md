# SSL Certificates

This directory should contain your SSL certificates for production deployment.

## Required Files

- `cert.pem` - SSL certificate file
- `key.pem` - SSL private key file

## Generating Self-Signed Certificates (Development Only)

For development purposes, you can generate self-signed certificates:

```bash
# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate signing request
openssl req -new -key key.pem -out cert.csr

# Generate self-signed certificate
openssl x509 -req -days 365 -in cert.csr -signkey key.pem -out cert.pem

# Clean up CSR file
rm cert.csr
```

## Production Certificates

For production, use certificates from a trusted Certificate Authority (CA) such as:

- Let's Encrypt (free)
- DigiCert
- Comodo
- GoDaddy

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d cms.yourdomain.com -d api.yourdomain.com

# Copy certificates to nginx/ssl directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./key.pem
```

## Security Notes

- Never commit SSL private keys to version control
- Use strong encryption (RSA 2048-bit minimum)
- Regularly renew certificates before expiration
- Consider using ECDSA certificates for better performance
- Implement proper file permissions (600 for private keys)

## File Permissions

Set proper permissions for SSL files:

```bash
chmod 644 cert.pem
chmod 600 key.pem
chown root:root cert.pem key.pem
```