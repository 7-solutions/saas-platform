package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	jwtlib "shared/go-jwt"
	"shared/go-logger"
	"shared/go-metrics"
)

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func main() {
	os.Setenv("SERVICE_NAME", "auth")
	logger.Init(getenv("LOG_LEVEL", "info"), getenv("LOG_FORMAT", "json"))
	log := logger.L()

	// Metrics
	m := metrics.New("auth")
	metricsAddr := getenv("METRICS_ADDR", ":9100")
	m.Serve(metricsAddr)
	log.Info("metrics started", "addr", metricsAddr)

	// JWT
	kp, err := jwtlib.LoadOrGenerate()
	if err != nil {
		log.Error("jwt init failed", "err", err)
		os.Exit(1)
	}
	_ = kp

	// gRPC server
	grpcAddr := getenv("GRPC_ADDR", ":9101")
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		log.Error("grpc listen failed", "addr", grpcAddr, "err", err)
		os.Exit(1)
	}
	grpcServer := grpc.NewServer()
	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthSrv)

	go func() {
		log.Info("grpc serving", "addr", grpcAddr)
		if err := grpcServer.Serve(lis); err != nil {
			log.Error("grpc server error", "err", err)
		}
	}()

	// HTTP health for Docker
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})
	httpAddr := getenv("HTTP_ADDR", ":8101")
	httpSrv := &http.Server{
		Addr:              httpAddr,
		Handler:           withMetrics(m, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Info("http health serving", "addr", httpAddr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("http server error", "err", err)
		}
	}()

	// Shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop
	log.Info("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	grpcServer.GracefulStop()
	_ = httpSrv.Shutdown(ctx)
	_ = m.Shutdown(ctx)
	log.Info("shutdown complete")
}

func withMetrics(m *metrics.Metrics, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &rw{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		p := r.URL.Path
		m.HTTPRequests.WithLabelValues(r.Method, p, fmt.Sprintf("%d", ww.status)).Inc()
		m.HTTPLatency.WithLabelValues(r.Method, p).Observe(time.Since(start).Seconds())
	})
}

type rw struct {
	http.ResponseWriter
	status int
}

func (w *rw) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}