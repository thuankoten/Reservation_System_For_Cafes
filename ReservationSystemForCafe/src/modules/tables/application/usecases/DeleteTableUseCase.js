export class DeleteTableUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  async execute({ tableId }) {
    return this.tableRepo.delete({ tableId })
  }
}
