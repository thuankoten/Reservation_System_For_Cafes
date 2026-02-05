import { useMemo } from 'react'
import { ServiceContext } from './ServiceContext'
import { auth, db } from '../shared/firebase'
import { FirestoreReservationRepository } from '../modules/reservations/infrastructure/firestore/FirestoreReservationRepository'
import { FirestoreTableRepository } from '../modules/tables/infrastructure/firestore/FirestoreTableRepository'
import { FirestoreMetaRepository } from '../modules/meta/infrastructure/firestore/FirestoreMetaRepository'
import { FirestoreUserRepository } from '../modules/users/infrastructure/firestore/FirestoreUserRepository'
import { FirebaseAuthGateway } from '../modules/auth/infrastructure/firebase/FirebaseAuthGateway'
import { ApproveReservationUseCase } from '../modules/reservations/application/usecases/ApproveReservationUseCase'
import { RejectReservationUseCase } from '../modules/reservations/application/usecases/RejectReservationUseCase'
import { CancelReservationUseCase } from '../modules/reservations/application/usecases/CancelReservationUseCase'
import { ExpireOverdueReservationsUseCase } from '../modules/reservations/application/usecases/ExpireOverdueReservationsUseCase'
import { CheckInReservationUseCase } from '../modules/reservations/application/usecases/CheckInReservationUseCase'
import { CheckOutReservationUseCase } from '../modules/reservations/application/usecases/CheckOutReservationUseCase'
import { EnsureBookingUserUseCase } from '../modules/auth/application/usecases/EnsureBookingUserUseCase'
import { PingServerOffsetMinutesUseCase } from '../modules/meta/application/usecases/PingServerOffsetMinutesUseCase'
import { GetUserByIdUseCase } from '../modules/users/application/usecases/GetUserByIdUseCase'
import { ListAdminUsersUseCase } from '../modules/users/application/usecases/ListAdminUsersUseCase'
import { ListCustomerUsersUseCase } from '../modules/users/application/usecases/ListCustomerUsersUseCase'
import { ToggleUserStatusUseCase } from '../modules/users/application/usecases/ToggleUserStatusUseCase'
import { DeleteUserUseCase } from '../modules/users/application/usecases/DeleteUserUseCase'
import { AssignFloorsUseCase } from '../modules/tables/application/usecases/AssignFloorsUseCase'
import { SaveTableEditUseCase } from '../modules/tables/application/usecases/SaveTableEditUseCase'
import { CreateTableUseCase } from '../modules/tables/application/usecases/CreateTableUseCase'
import { DeleteTableUseCase } from '../modules/tables/application/usecases/DeleteTableUseCase'
import { ManualCheckInUseCase } from '../modules/tables/application/usecases/ManualCheckInUseCase'
import { ManualCheckOutUseCase } from '../modules/tables/application/usecases/ManualCheckOutUseCase'
import { ReconcileTableStatusesUseCase } from '../modules/tables/application/usecases/ReconcileTableStatusesUseCase'
import { CreateHoldReservationUseCase } from '../modules/reservations/application/usecases/CreateHoldReservationUseCase'
import { CancelHoldReservationUseCase } from '../modules/reservations/application/usecases/CancelHoldReservationUseCase'

export function ServiceContainerProvider({ children }) {
  const container = useMemo(() => {
    const repos = {
      reservations: new FirestoreReservationRepository({ db }),
      tables: new FirestoreTableRepository({ db }),
      meta: new FirestoreMetaRepository({ db }),
      users: new FirestoreUserRepository({ db }),
    }

    const gateways = {
      auth: new FirebaseAuthGateway({ auth }),
    }

    const useCases = {
      approveReservation: new ApproveReservationUseCase({
        reservationRepo: repos.reservations,
        tableRepo: repos.tables,
      }),
      rejectReservation: new RejectReservationUseCase({
        reservationRepo: repos.reservations,
        tableRepo: repos.tables,
      }),
      cancelReservation: new CancelReservationUseCase({
        reservationRepo: repos.reservations,
        tableRepo: repos.tables,
      }),
      expireOverdueReservations: new ExpireOverdueReservationsUseCase({
        reservationRepo: repos.reservations,
        tableRepo: repos.tables,
      }),
      checkInReservation: new CheckInReservationUseCase({
        reservationRepo: repos.reservations,
        tableRepo: repos.tables,
      }),
      checkOutReservation: new CheckOutReservationUseCase({
        reservationRepo: repos.reservations,
        tableRepo: repos.tables,
      }),
      ensureBookingUser: new EnsureBookingUserUseCase({ authGateway: gateways.auth }),
      pingServerOffsetMinutes: new PingServerOffsetMinutesUseCase({ metaRepo: repos.meta }),
      getUserById: new GetUserByIdUseCase({ userRepo: repos.users }),
      listAdminUsers: new ListAdminUsersUseCase({ userRepo: repos.users }),
      listCustomerUsers: new ListCustomerUsersUseCase({ userRepo: repos.users }),
      toggleUserStatus: new ToggleUserStatusUseCase({ userRepo: repos.users }),
      deleteUser: new DeleteUserUseCase({ userRepo: repos.users }),
      assignFloors: new AssignFloorsUseCase({ tableRepo: repos.tables }),
      saveTableEdit: new SaveTableEditUseCase({ tableRepo: repos.tables }),
      createTable: new CreateTableUseCase({ tableRepo: repos.tables }),
      deleteTable: new DeleteTableUseCase({ tableRepo: repos.tables }),
      manualCheckIn: new ManualCheckInUseCase({ tableRepo: repos.tables }),
      manualCheckOut: new ManualCheckOutUseCase({ tableRepo: repos.tables }),
      reconcileTableStatuses: new ReconcileTableStatusesUseCase({ tableRepo: repos.tables }),
      createHoldReservation: new CreateHoldReservationUseCase({ reservationRepo: repos.reservations }),
      cancelHoldReservation: new CancelHoldReservationUseCase({ reservationRepo: repos.reservations }),
    }

    return { repos, useCases }
  }, [])

  return <ServiceContext.Provider value={container}>{children}</ServiceContext.Provider>
}
