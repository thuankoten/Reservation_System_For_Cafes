import { useEffect, useMemo, useState } from 'react'
import ReservationRow from '../components/ReservationRow'
import ReservationFilter from '../components/ReservationFilter'
import { useReservationsQuery } from '../../../modules/reservations/application/queries/useReservationsQuery'
import { filterReservationsByStatus, groupAdminReservations, searchReservations } from '../../../modules/reservations/application/presenters/adminReservationsPresenter'
import { useServices } from '../../../app/ServiceContext'

export default function AdminReservationPage() {
  const { useCases } = useServices()
  const { rows } = useReservationsQuery()
  const [filter, setFilter] = useState('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    let timerId
    async function runExpire() {
      try {
        await useCases.expireOverdueReservations.execute({ reservations: rows })
      } catch {
        void 0
      }
    }
    runExpire()
    timerId = setInterval(runExpire, 5 * 60 * 1000)
    return () => timerId && clearInterval(timerId)
  }, [rows, useCases.expireOverdueReservations])

  //  SEARCH 
  const searched = useMemo(() => {
    return searchReservations({ rows, keyword })
  }, [rows, keyword])

  //  FILTER STATUS 
  const filtered = useMemo(() => {
    return filterReservationsByStatus({ rows: searched, filter })
  }, [searched, filter])

  const grouped = useMemo(() => {
    return groupAdminReservations({ rows: filtered })
  }, [filtered])

  //  ACTIONS 
  async function confirm(r) {
    await useCases.approveReservation.execute({ reservation: r })
  }

  async function cancel(r) {
    await useCases.cancelReservation.execute({ reservation: r })
  }

  async function reject(r) {
    await useCases.rejectReservation.execute({ reservation: r })
  }

  // Expiration handled automatically via AdminTablesPage and Cloud Function.

  //  UI 
  return (
    <div className="stack">
      <h2 className="pageTitle">
        Admin • Reservations
      </h2>

      <ReservationFilter
        value={filter}
        onChange={setFilter}
        keyword={keyword}
        onKeywordChange={setKeyword}
      />

      <Section
        title="Waiting for approval"
        data={grouped.waiting}
        onConfirm={confirm}
        onReject={reject}
      />

      <Section
        title="Reservations today"
        data={grouped.todaySorted}
        onCancel={cancel}
      />

      <Section
        title="Reservations next days"
        data={grouped.upcomingSorted}
        onCancel={cancel}
      />

      <Section
        title="Yesterday"
        data={grouped.yesterdaySorted}
      />

      <Section
        title="Older reservations"
        data={grouped.olderSorted}
      />
    </div>
  )
}

//  SECTION 
function Section({ title, data, ...actions }) {
  return (
    <>
      <h3 style={{ marginTop: 24 }}>
        {title}
      </h3>

      {data.length === 0 && (
        <div className="muted">
          No reservations
        </div>
      )}

      {data.map(r => (
        <ReservationRow
          key={r.id}
          r={r}
          {...actions}
        />
      ))}

      <hr
        style={{
          margin: '24px 0',
          opacity: 0.2,
        }}
      />
    </>
  )
}
  