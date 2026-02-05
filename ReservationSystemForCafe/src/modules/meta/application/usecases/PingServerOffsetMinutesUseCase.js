export class PingServerOffsetMinutesUseCase {
  constructor({ metaRepo }) {
    this.metaRepo = metaRepo
  }

  async execute() {
    return this.metaRepo.pingServerOffsetMinutes()
  }
}
