import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { MyIncidentsSection } from './components/MyIncidentsSection';

/**
 * Tab "Sự vụ của tôi" — tách riêng khỏi SafetyDashboardPage (trước đây
 * MyIncidentsSection nằm cuối trang Tổng quan An toàn) thành 1 route/tab
 * nav độc lập, theo yêu cầu Sin (09/10/2026). Component bên trong
 * (`MyIncidentsSection`) giữ nguyên, không viết lại logic lọc "của tôi".
 */
export default function MyIncidentsPage() {
  return (
    <>
      <PageHeader title="Sự vụ của tôi" subtitle="Hồ sơ bạn đang là chỉ huy hoặc đang tham gia" icon={<ClipboardCheck />} />
      <MyIncidentsSection />
    </>
  );
}
