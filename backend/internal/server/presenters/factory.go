package presenters

import (
	"github.com/7-solutions/saas-platformbackend/internal/ports"
)

// NewPresenters returns concrete presenter adapters for gRPC and HTTP.
// TODO: Inject into server bootstrap when wiring handlers/servers.
func NewPresenters() (ports.ContentGrpcPresenter, ports.ContentHTTPPresenter) {
	return NewContentGrpcPresenter(), NewContentHTTPPresenter()
}
