// Trang hướng dẫn sử dụng nhanh cho giáo viên.
import { Button, Card } from '../components/ui';
import { navigate } from './useRoute';

export function HelpPage() {
  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Hướng dẫn sử dụng</h1>
            <p>Quy trình 4 bước để tổ chức một phiên thi "Nhanh như chớp – Vòng tinh hoa".</p>
          </div>
          <Button variant="primary" onClick={() => navigate('/')}>
            Về thư viện
          </Button>
        </div>

        <div className="grid grid--cards">
          <Card>
            <h3 className="card__title">1. Chuẩn bị bộ câu hỏi</h3>
            <p>Tạo bộ mới hoặc dùng bộ mẫu. Thêm câu hỏi thủ công, hoặc nhập từ Excel bằng file mẫu.</p>
            <p className="list-row__hint">Mỗi câu: nội dung, 4 đáp án, chọn 1 đáp án đúng, độ khó và giải thích.</p>
          </Card>
          <Card>
            <h3 className="card__title">2. Thiết lập phiên thi</h3>
            <p>Đặt tên phiên, số đội (2–8), tên và màu đội, chọn bộ câu cho từng đội hoặc chia từ một bộ chung.</p>
            <p className="list-row__hint">Khuyến nghị 30 câu mỗi đội cho lượt 60 giây; tối thiểu 10 câu.</p>
          </Card>
          <Card>
            <h3 className="card__title">3. Chơi trên sân khấu</h3>
            <p>Giáo viên bấm bắt đầu từng lượt, đếm 3–2–1 rồi đội trả lời. Dùng phím 1–4 hoặc A–D để chọn đáp án, Space để tạm dừng.</p>
            <p className="list-row__hint">Sai/đúng hiện trong 450 ms; 10 giây cuối đổi màu đồng hồ.</p>
          </Card>
          <Card>
            <h3 className="card__title">4. Kết quả và xem lại</h3>
            <p>Xem bảng xếp hạng, xem lại từng câu theo đội, xuất kết quả Excel và sao lưu phiên dạng JSON.</p>
            <p className="list-row__hint">Nếu hòa, dùng "Câu phụ" với thẻ giấy A/B/C/D để phân định.</p>
          </Card>
        </div>

        <Card className="grid" as="section">
          <h3 className="card__title">Lưu ý về dữ liệu</h3>
          <p>
            Bộ câu hỏi và lịch sử phiên được lưu trên chính trình duyệt này. Hãy xuất bản sao lưu JSON
            để chuyển máy hoặc tránh mất dữ liệu khi xóa dữ liệu trình duyệt.
          </p>
          <p className="list-row__hint">
            localhost, bản preview và bản production là các origin khác nhau nên dữ liệu không dùng chung.
          </p>
        </Card>
      </div>
    </main>
  );
}
