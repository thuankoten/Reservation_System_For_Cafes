import React, { useState, useEffect } from "react";
import styles from "./AdminDashboard.module.css";
import { db } from "../shared/firebase"; 
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0 });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (!db) return;

    
    const unsubscribeTables = onSnapshot(collection(db, "tables"), (snapshot) => {
      let t = 0, a = 0, o = 0;
      snapshot.forEach((doc) => {
        t++;
        if (doc.data().status === 'available') a++;
        else o++;
      });
      setStats({ total: t, available: a, occupied: o });
    });

    
    const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"), limit(5));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActivities(list);
    });

    return () => {
      unsubscribeTables();
      unsubscribeEvents();
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Bảng điều khiển Admin</h1>
        <p>Chào <strong>Quản trị viên</strong>, đây là tình hình quán hôm nay.</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <p className={styles.statLabel}>Tổng số bàn</p>
          <p className={styles.statValue}>{stats.total || 18}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.statLabel} style={{ color: '#28a745' }}>Bàn trống</p>
          <p className={styles.statValue} style={{ color: '#28a745' }}>{stats.available || 14}</p>
        </div>
        <div className={styles.card}>
          <p className={styles.statLabel} style={{ color: '#dc3545' }}>Đang ngồi</p>
          <p className={styles.statValue} style={{ color: '#dc3545' }}>{stats.occupied || 4}</p>
        </div>
      </div>

      <div className={styles.activitySection}>
        <h3>Hoạt động hệ thống mới nhất</h3>
        <div className={styles.activityList}>
          {activities.length > 0 ? activities.map((act) => (
            <div key={act.id} className={styles.activityItem}>
              <span>✅ <b>{act.customerName || "Khách"}</b> đã đặt <b>Bàn {act.tableId?.slice(-3).toUpperCase()}</b></span>
              <span className={styles.time}>
                {act.createdAt?.toDate ? act.createdAt.toDate().toLocaleTimeString('vi-VN') : "Vừa xong"}
              </span>
            </div>
          )) : (
            <p style={{ color: '#999', textAlign: 'center' }}>Đang chờ dữ liệu...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;