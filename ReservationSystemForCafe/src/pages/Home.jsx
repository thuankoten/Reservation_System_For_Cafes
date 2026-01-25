import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.homeContainer}>
      {/* PHẦN BANNER CHÍNH */}
      <section className={styles.hero}>
        <h1>AROMA CAFE</h1>
        <p>Thưởng thức hương vị cà phê nguyên chất trong không gian yên bình và ấm cúng.</p>
        <button 
          className={styles.ctaButton}
          onClick={() => navigate('/dashboard/tables')}
        >
          Đặt Bàn Ngay
        </button>
      </section>

      {/* PHẦN GIỚI THIỆU TÍNH NĂNG */}
      <section className={styles.features}>
        <div className={styles.featureItem}>
          <div style={{ fontSize: '3rem' }}>☕</div>
          <h3>Cà Phê Thượng Hạng</h3>
          <p>Hạt cà phê được tuyển chọn kỹ lưỡng từ những vùng nguyên liệu tốt nhất.</p>
        </div>

        <div className={styles.featureItem}>
          <div style={{ fontSize: '3rem' }}>🛋️</div>
          <h3>Không Gian Đẹp</h3>
          <p>Phong cách decor hiện đại, phù hợp để làm việc và gặp gỡ bạn bè.</p>
        </div>

        <div className={styles.featureItem}>
          <div style={{ fontSize: '3rem' }}>⚡</div>
          <h3>Đặt Chỗ Nhanh</h3>
          <p>Hệ thống đặt bàn trực tuyến tiện lợi, không lo hết chỗ vào giờ cao điểm.</p>
        </div>
      </section>

      {/* PHẦN FOOTER ĐƠN GIẢN */}
      <footer style={{ 
        padding: '20px', 
        textAlign: 'center', 
        backgroundColor: '#333', 
        color: '#fff' 
      }}>
        <p>&copy; 2026 Aroma Cafe System - Được thực hiện bởi Minh</p>
      </footer>
    </div>
  );
};

export default Home;