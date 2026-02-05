import { USER_ROLES } from '../../domain/userConstants'

export class ListCustomerUsersUseCase {
  constructor({ userRepo }) {
    this.userRepo = userRepo
  }

  async execute() {
    return this.userRepo.listByRole({ role: USER_ROLES.CUSTOMER })
  }
}
