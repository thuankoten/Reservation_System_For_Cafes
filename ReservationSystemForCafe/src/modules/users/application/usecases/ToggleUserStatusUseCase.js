export class ToggleUserStatusUseCase {
  constructor({ userRepo }) {
    this.userRepo = userRepo
  }

  async execute({ userId }) {
    return this.userRepo.toggleStatus({ userId })
  }
}
