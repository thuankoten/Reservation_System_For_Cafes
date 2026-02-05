export class EnsureBookingUserUseCase {
  constructor({ authGateway }) {
    this.authGateway = authGateway
  }

  async execute({ displayName }) {
    return this.authGateway.ensureAnonymousUser({ displayName })
  }
}
