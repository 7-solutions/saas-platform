module api-gateway

go 1.24

require (
	shared/go-jwt v0.0.0-00010101000000-000000000000
	shared/go-logger v0.0.0-00010101000000-000000000000
	shared/go-metrics v0.0.0-00010101000000-000000000000
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
	github.com/matttproud/golang_protobuf_extensions/v2 v2.0.0 // indirect
	github.com/prometheus/client_golang v1.18.0 // indirect
	github.com/prometheus/client_model v0.5.0 // indirect
	github.com/prometheus/common v0.45.0 // indirect
	github.com/prometheus/procfs v0.12.0 // indirect
	golang.org/x/net v0.38.0 // indirect
	golang.org/x/sys v0.31.0 // indirect
	golang.org/x/text v0.26.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20250603155806-513f23925822 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250603155806-513f23925822 // indirect
	google.golang.org/protobuf v1.36.6 // indirect
)

replace shared/go-logger => ../shared/go-logger

replace shared/go-metrics => ../shared/go-metrics

replace shared/go-jwt => ../shared/go-jwt

require github.com/grpc-ecosystem/grpc-gateway/v2 v2.27.1

require (
	google.golang.org/grpc v1.73.0
	shared/gen v0.0.0-00010101000000-000000000000
)

replace shared/gen => ../shared/gen
