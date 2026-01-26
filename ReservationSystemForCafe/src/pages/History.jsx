import React, { useState, useEffect } from 'react';
import { db, auth } from '../../../shared/firebase'; // Đảm bảo đường dẫn này đúng tới file firebase.js
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Đợi cho đến khi Firebase xác định được người dùng đã đăng nhập chưa
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // Truy vấn lấy đơn đặt bàn của user này, sắp xếp theo thời gian mới nhất
        const q = query(
          collection(db, 'reservations'),
          where('userId', '==', user.uid)
        );

        const unsubscribeData = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setHistory(docs);
          setLoading(false);
        });

        return () => unsubscribeData();
      } else {
        setHistory([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) return <div className="p-4">Loading history...</div>;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Lịch sử đặt bàn của bạn</h2>
      {history.length === 0 ? (
        <p className="text-gray-500">Bạn chưa có đơn đặt bàn nào.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {history.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.id.slice(0, 8)}...</td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.date}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-white ${item.status === 'confirmed' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                    {item.status || 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default History;