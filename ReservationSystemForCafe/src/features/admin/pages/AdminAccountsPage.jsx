import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useServices } from '../../../app/ServiceContext'
import { USER_ROLES, USER_STATUS } from '../../../modules/users/domain/userConstants'
import './AdminAccountsPage.css'

export default function AdminAccountsPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const { useCases } = useServices()
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [activeTab, setActiveTab] = useState('customer') // 'admin' or 'customer'
  const [adminUsers, setAdminUsers] = useState([])
  const [customerUsers, setCustomerUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState('')

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      if (currentUserRole === USER_ROLES.SYSTEM_ADMIN) {
        const [admins, customers] = await Promise.all([
          useCases.listAdminUsers.execute(),
          useCases.listCustomerUsers.execute(),
        ])
        setAdminUsers(admins)
        setCustomerUsers(customers)
      } else if (currentUserRole === USER_ROLES.ADMIN) {
        const customers = await useCases.listCustomerUsers.execute()
        setCustomerUsers(customers)
        setAdminUsers([])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [currentUserRole, useCases.listAdminUsers, useCases.listCustomerUsers])

  useEffect(() => {
    let cancelled = false

    async function loadRole() {
      if (authLoading) return
      if (!currentUser?.uid) {
        if (!cancelled) setCurrentUserRole('')
        return
      }
      try {
        const userDoc = await useCases.getUserById.execute({ userId: currentUser.uid })
        if (!cancelled) setCurrentUserRole(userDoc?.role || '')
      } catch {
        if (!cancelled) setCurrentUserRole('')
      }
    }

    loadRole()
    return () => { cancelled = true }
  }, [authLoading, currentUser?.uid, useCases.getUserById])

  useEffect(() => {
    if (currentUserRole) {
      loadUsers()
    }
  }, [currentUserRole, loadUsers])

  const handleToggleStatus = async (userId) => {
    // Prevent disabling own account
    if (currentUser && userId === currentUser.uid) {
      setError('You cannot disable your own account')
      return
    }
    try {
      setProcessingId(userId)
      await useCases.toggleUserStatus.execute({ userId })
      await loadUsers() // Reload to get updated status
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingId('')
    }
  }

  const handleDeleteUser = async (userId) => {
    // Prevent deleting own account
    if (currentUser && userId === currentUser.uid) {
      setError('You cannot delete your own account')
      return
    }
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      setProcessingId(userId)
      await useCases.deleteUser.execute({ userId })
      await loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingId('')
    }
  }

  const canManageAdmins = currentUserRole === USER_ROLES.SYSTEM_ADMIN
  const canManageCustomers = currentUserRole === USER_ROLES.SYSTEM_ADMIN || currentUserRole === USER_ROLES.ADMIN

  if (!currentUser) {
    return <div className="admin-accounts-page">Please sign in</div>
  }

  if (!canManageAdmins && !canManageCustomers) {
    return <div className="admin-accounts-page">Access denied</div>
  }

  return (
    <div className="admin-accounts-page">
      <h1>Account Management</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="tabs">
        {canManageCustomers && (
          <button
            className={`tab-button ${activeTab === 'customer' ? 'active' : ''}`}
            onClick={() => setActiveTab('customer')}
          >
            Customer Accounts
          </button>
        )}
        {canManageAdmins && (
          <button
            className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Accounts
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'customer' && canManageCustomers && (
          <div className="user-list">
            <h2>Customer Accounts</h2>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.displayName || 'N/A'}</td>
                      <td>
                        <span className={`status ${user.status}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>{user.createdAt?.toDate?.()?.toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => handleToggleStatus(user.id)}
                          disabled={processingId === user.id}
                          className="action-button"
                        >
                          {user.status === USER_STATUS.ACTIVE ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'admin' && canManageAdmins && (
          <div className="user-list">
            <h2>Admin Accounts</h2>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.displayName || 'N/A'}</td>
                      <td>{user.role}</td>
                      <td>
                        <span className={`status ${user.status}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>{user.createdAt?.toDate?.()?.toLocaleDateString()}</td>
                      <td>
                        {(() => {
                          const isSelf = currentUser && user.id === currentUser.uid
                          const disableReason = isSelf ? 'You cannot manage your own account' : ''
                          return (
                            <>
                              <button
                                onClick={() => handleToggleStatus(user.id)}
                                disabled={processingId === user.id || isSelf}
                                className="action-button"
                                title={disableReason}
                              >
                                {user.status === USER_STATUS.ACTIVE ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={processingId === user.id || isSelf}
                                className="action-button delete"
                                title={disableReason}
                              >
                                Delete
                              </button>
                            </>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}