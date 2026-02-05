export class ManualCheckOutUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  async execute({ tableId, keepReserved = false }) {
    return this.tableRepo.releaseManual({ tableId, keepReserved })
  }
}
