export class AssignFloorsUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  async execute({ tables }) {
    return this.tableRepo.assignFloors({ tables })
  }
}
