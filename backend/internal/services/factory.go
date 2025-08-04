package services

import (
	ports "github.com/7-solutions/saas-platformbackend/internal/ports"
	"github.com/7-solutions/saas-platformbackend/internal/repository"
)

// NewContentServiceFactoryWithPorts returns a ContentService constructed via ports and repositories.
// This is additive wiring and does not modify existing startup.
// TODO(adopt): Wire this in cmd/api or internal/server once repositories and uow are available.
func NewContentServiceFactoryWithPorts(
	pageRepo repository.PageRepository,
	blogRepo repository.BlogRepository,
	usersRepo ports.UsersRepository,
	contactRepo ports.ContactRepository,
	uow ports.UnitOfWork,
) *ContentService {
	return NewContentServiceWithPorts(pageRepo, blogRepo, usersRepo, contactRepo, uow)
}
