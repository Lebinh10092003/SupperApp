/**
 * MobileAnalyticsPage.tsx — bản mobile của "Phân tích & thống kê"
 * (/safety/analytics). Trang quản lý/lãnh đạo, ít dùng trên điện thoại —
 * đổi khung ngoài (NavBar + Tabs antd-mobile) nhưng TÁI DÙNG NGUYÊN 3
 * panel nội dung (đã export từ AnalyticsPage.tsx bản desktop) vì phần đó
 * không phải chỗ Sin phàn nàn.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Tabs } from 'antd-mobile';
import { Box } from '@mui/material';
import { TrendAlertsPanel, CampusComparisonPanel, ClassStatsPanel } from '../../features/safety/AnalyticsPage';
import { MobileScreenShell } from '../MobileScreenShell';
import { MobileTabBar } from '../MobileTabBar';

export default function MobileAnalyticsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('trend');

  return (
    <MobileScreenShell header={<NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>Phân tích & thống kê</NavBar>} tabBar={<MobileTabBar />} contentPadding={false}>
      <Tabs activeKey={tab} onChange={setTab}>
        <Tabs.Tab title="Đề xuất xử lý" key="trend" />
        <Tabs.Tab title="So sánh cơ sở" key="campus" />
        <Tabs.Tab title="Theo lớp học" key="class" />
      </Tabs>
      <Box sx={{ p: 2, overflowX: 'auto' }}>
        {tab === 'trend' && <TrendAlertsPanel />}
        {tab === 'campus' && <CampusComparisonPanel />}
        {tab === 'class' && <ClassStatsPanel />}
      </Box>
    </MobileScreenShell>
  );
}
