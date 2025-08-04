package main

import (
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/7-solutions/saas-platformbackend/internal/server"
)

func main() {
	// Get ports from environment variables
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "9090"
	}

	httpPort := os.Getenv("HTTP_PORT")
	if httpPort == "" {
		httpPort = "8080"
	}

	metricsPort := os.Getenv("METRICS_PORT")
	if metricsPort == "" {
		metricsPort = "8081"
	}

	// Create server
	srv, err := server.NewServer()
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// Setup graceful shutdown
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	var wg sync.WaitGroup

	// Start gRPC server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := srv.StartGRPC(grpcPort); err != nil {
			log.Fatalf("Failed to start gRPC server: %v", err)
		}
	}()

	// Start HTTP gateway server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := srv.StartHTTP(grpcPort, httpPort); err != nil {
			log.Fatalf("Failed to start HTTP server: %v", err)
		}
	}()

	// Start metrics server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := srv.StartMetrics(metricsPort); err != nil {
			log.Fatalf("Failed to start metrics server: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-c
	log.Println("Shutting down servers...")
	srv.Stop()
	wg.Wait()
	log.Println("Servers stopped")
}
