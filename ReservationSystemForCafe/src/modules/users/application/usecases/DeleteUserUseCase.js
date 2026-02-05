export class DeleteUserUseCase {
  constructor({ userRepo }) {
    this.userRepo = userRepo
  }

  async execute({ userId }) {
    return this.userRepo.deleteProfile({ userId })
  }
}
