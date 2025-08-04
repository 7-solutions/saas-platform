package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "shared/gen/auth/v1"
	contactv1 "shared/gen/contact/v1"
	contentv1 "shared/gen/content/v1"
	mediav1 "shared/gen/media/v1"
	jwtlib "shared/go-jwt"
	"shared/go-logger"
	"shared/go-metrics"
)

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	os.Setenv("SERVICE_NAME", "api-gateway")
	logger.Init(getenv("LOG_LEVEL", "info"), getenv("LOG_FORMAT", "json"))
	log := logger.L()

	// Metrics
	m := metrics.New("api_gateway")
	metricsAddr := getenv("METRICS_ADDR", ":9090")
	m.Serve(metricsAddr)
	log.Info("metrics server started", "addr", metricsAddr)

	// JWT keys (optional at gateway; mainly for passing through)
	_, _ = jwtlib.LoadOrGenerate()

	// Base mux with health endpoints
	root := http.NewServeMux()
	root.HandleFunc("/health/live", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})
	root.HandleFunc("/health/ready", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("READY"))
	})
	root.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// gRPC-Gateway mux
	gw := runtime.NewServeMux(
		runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{}),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Dial options (insecure within docker compose network)
	dialOpts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

	authAddr := getenv("AUTH_GRPC_ADDR", "auth:9101")
	contentAddr := getenv("CONTENT_GRPC_ADDR", "content:9102")
	mediaAddr := getenv("MEDIA_GRPC_ADDR", "media:9103")
	contactAddr := getenv("CONTACT_GRPC_ADDR", "contact:9104")

	// Register handlers from endpoints
	if err := authv1.RegisterAuthServiceHandlerFromEndpoint(ctx, gw, authAddr, dialOpts); err != nil {
		log.Error("register auth gateway failed", "err", err)
	}
	if err := contentv1.RegisterContentServiceHandlerFromEndpoint(ctx, gw, contentAddr, dialOpts); err != nil {
		log.Error("register content gateway failed", "err", err)
	}
	if err := mediav1.RegisterMediaServiceHandlerFromEndpoint(ctx, gw, mediaAddr, dialOpts); err != nil {
		log.Error("register media gateway failed", "err", err)
	}
	if err := contactv1.RegisterContactServiceHandlerFromEndpoint(ctx, gw, contactAddr, dialOpts); err != nil {
		log.Error("register contact gateway failed", "err", err)
	}

	// Mount the gateway under /
	root.Handle("/", gw)

	// Metrics middleware wrapper
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &respWriter{ResponseWriter: w, status: 200}
		root.ServeHTTP(ww, r)
		path := r.URL.Path
		m.HTTPRequests.WithLabelValues(r.Method, path, fmt.Sprintf("%d", ww.status)).Inc()
		m.HTTPLatency.WithLabelValues(r.Method, path).Observe(time.Since(start).Seconds())
	})

	addr := getenv("HTTP_ADDR", ":8080")
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		TLSConfig:         &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: x509.NewCertPool()},
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Error("failed to listen", "addr", addr, "err", err)
		os.Exit(1)
	}
	go func() {
		log.Info("http server starting", "addr", addr)
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Error("http server error", "err", err)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	<-stop
	log.Info("shutting down")

	ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	_ = srv.Shutdown(ctxShutdown)
	_ = m.Shutdown(ctxShutdown)
	log.Info("shutdown complete")
}

type respWriter struct {
	http.ResponseWriter
	status int
}

func (w *respWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}