export class ManualCheckInUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  async execute({ tableId, note }) {
    return this.tableRepo.occupyManual({ tableId, note })
  }
}
