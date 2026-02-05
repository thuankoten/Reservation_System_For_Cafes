export class GetUserByIdUseCase {
  constructor({ userRepo }) {
    this.userRepo = userRepo
  }

  async execute({ userId }) {
    return this.userRepo.getById({ userId })
  }
}
