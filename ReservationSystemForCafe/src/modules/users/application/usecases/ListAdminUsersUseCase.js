import { USER_ROLES } from '../../domain/userConstants'

export class ListAdminUsersUseCase {
  constructor({ userRepo }) {
    this.userRepo = userRepo
  }

  async execute() {
    return this.userRepo.listByRoles({ roles: [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN] })
  }
}
