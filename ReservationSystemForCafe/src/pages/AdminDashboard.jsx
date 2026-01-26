import React, { useState, useEffect } from "react";
import styles from "./AdminDashboard.module.css";
import { db } from "../shared/firebase"; // Dòng duy nhất để lấy database
import { collection, getDocs } from "firebase/firestore";
const AdminDashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    occupied: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      const querySnapshot = await getDocs(collection(db, "tables"));
      let total = 0, available = 0, occupied = 0;
      
      querySnapshot.forEach((doc) => {
        total++;
        if (doc.data().status === 'available') available++;
        else occupied++;
      });

      setStats({ total, available, occupied });
    };

    fetchStats();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Bảng điều khiển Admin</h1>
        <p>Chào Minh, đây là tình hình quán hôm nay.</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <h3>Tổng số bàn</h3>
          <p>{stats.total}</p>
        </div>
        
        {/* CSS Inline cho màu sắc động theo trạng thái */}
        <div className={styles.card}>
          <h3>Bàn đang trống</h3>
          <p style={{ color: '#28a745' }}>{stats.available}</p>
        </div>

        <div className={styles.card}>
          <h3>Bàn có khách</h3>
          <p style={{ color: '#dc3545' }}>{stats.occupied}</p>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
        <h3>Hoạt động gần đây</h3>
        <p style={{ fontStyle: 'italic', color: '#999' }}>Chưa có đơn đặt mới nào...</p>
      </div>
    </div>
  );
};

export default AdminDashboard;