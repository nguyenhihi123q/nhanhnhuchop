import type { SeedRow } from './seed-format';

/** Bộ phụ — 18 câu dùng phân định đồng hạng (mục 6.4). Khó hơn, không trùng bộ chính. */
export const SET_TIEBREAK_ROWS: SeedRow[] = [
  ['Nguồn năng lượng nào sau đây là tái tạo?', 'Năng lượng gió', 'Than đá', 'Dầu mỏ', 'Khí tự nhiên', 0, 'Gió là nguồn năng lượng tái tạo, không cạn kiệt.', 'Năng lượng', 'vua'],
  ['Việc trồng cây xanh giúp giảm hiện tượng nào?', 'Hiệu ứng nhà kính', 'Núi lửa', 'Thủy triều', 'Nhật thực', 0, 'Cây hấp thụ CO2 nên giúp giảm hiệu ứng nhà kính.', 'Sống xanh', 'vua'],
  ['Chất nào gây thủng tầng ô-dôn?', 'Khí CFC', 'Khí oxy', 'Khí nitơ', 'Hơi nước', 0, 'Khí CFC phá hủy tầng ô-dôn.', 'Ô nhiễm không khí', 'kho'],
  ['Vật liệu nào phân hủy sinh học nhanh nhất?', 'Vỏ chuối', 'Túi ni lông', 'Chai nhựa', 'Lon nhôm', 0, 'Vỏ chuối là rác hữu cơ phân hủy nhanh.', 'Rác thải', 'de'],
  ['Đơn vị đo lượng nước tiêu thụ thường dùng là gì?', 'Mét khối (m³)', 'Kilôgam (kg)', 'Oát (W)', 'Vôn (V)', 0, 'Lượng nước thường đo bằng mét khối.', 'Tiết kiệm tài nguyên', 'kho'],
  ['Hiện tượng nước biển dâng do đâu?', 'Băng tan và giãn nở nhiệt do nóng lên toàn cầu', 'Do thủy triều lên', 'Do gió mùa', 'Do sóng thần', 0, 'Nóng lên toàn cầu làm băng tan khiến nước biển dâng.', 'Biến đổi khí hậu', 'kho'],
  ['Chỉ số AQI là gì?', 'Chỉ số chất lượng không khí', 'Chỉ số chất lượng nước', 'Chỉ số tiếng ồn', 'Chỉ số đất', 0, 'AQI là chỉ số chất lượng không khí.', 'Ô nhiễm không khí', 'vua'],
  ['Cách giảm khí thải khi đi lại là gì?', 'Đi chung xe, xe buýt hoặc xe đạp', 'Đi xe máy một mình', 'Đi ô tô riêng', 'Đi máy bay nội địa', 0, 'Đi chung xe/xe đạp giúp giảm khí thải.', 'Giao thông xanh', 'vua'],
  ['Lũ quét thường xảy ra ở đâu?', 'Khu vực dốc, sông suối nhỏ, mưa lớn', 'Đồng bằng rộng', 'Sa mạc', 'Biển khơi', 0, 'Lũ quét hay xảy ra ở vùng dốc, sông suối nhỏ khi mưa lớn.', 'Ứng phó thiên tai', 'vua'],
  ['Cây nào sau đây là cây ngập mặn chắn sóng?', 'Cây đước', 'Cây thông', 'Cây bàng', 'Cây phượng', 0, 'Rừng đước ngập mặn giúp chắn sóng, chống xói lở.', 'Sống xanh', 'vua'],
  ['Việc tái chế nhôm tiết kiệm được gì?', 'Năng lượng và tài nguyên quặng', 'Thời gian ngủ', 'Không gian nhà', 'Nước uống', 0, 'Tái chế nhôm tiết kiệm năng lượng và quặng.', 'Tiết kiệm tài nguyên', 'vua'],
  ['Đâu là nguyên nhân chính gây ô nhiễm nguồn nước?', 'Nước thải và rác chưa qua xử lý', 'Mưa tự nhiên', 'Nước ngầm', 'Sương mù', 0, 'Nước thải và rác chưa xử lý là nguyên nhân chính.', 'Ô nhiễm nước', 'vua'],
  ['Cách bảo vệ tầng ô-dôn là gì?', 'Giảm khí thải CFC, dùng thiết bị thân thiện môi trường', 'Tăng khí CFC', 'Đốt rừng', 'Dùng nhiều bình xịt cũ', 0, 'Giảm khí CFC giúp bảo vệ tầng ô-dôn.', 'Ô nhiễm không khí', 'kho'],
  ['Hiện tượng El Nino gây ra điều gì?', 'Thay đổi thời tiết bất thường, hạn hán và lũ lụt', 'Băng tan vĩnh viễn', 'Núi lửa phun', 'Nhật thực', 0, 'El Nino gây thời tiết bất thường, hạn và lũ.', 'Biến đổi khí hậu', 'kho'],
  ['Cách giảm rác thải thực phẩm là gì?', 'Lập kế hoạch bữa ăn và bảo quản đúng cách', 'Mua nhiều rồi bỏ', 'Nấu dư thừa', 'Vứt trước khi hỏng', 0, 'Lập kế hoạch và bảo quản đúng giúp giảm rác thực phẩm.', 'Tiết kiệm tài nguyên', 'vua'],
  ['Vì sao rạn san hô quan trọng?', 'Là nơi sinh sống của nhiều loài biển và chắn sóng', 'Chỉ để ngắm', 'Gây ô nhiễm', 'Là đá vô dụng', 0, 'San hô là môi trường sống quan trọng và chắn sóng.', 'Đa dạng sinh học', 'kho'],
  ['Chỉ số nào đo mức tiêu thụ điện của thiết bị?', 'Công suất (W/ kW)', 'Mét (m)', 'Lít (L)', 'Độ C (°C)', 0, 'Công suất đo mức tiêu thụ điện năng.', 'Năng lượng', 'vua'],
  ['Cách ứng phó khi nước lũ dâng cao trong nhà?', 'Ngắt điện, di chuyển lên cao, không lội nước chảy mạnh', 'Bật điện', 'Lội ra ngoài', 'Ở lại tầng trệt', 0, 'Ngắt điện và di chuyển lên cao để an toàn khi nước dâng.', 'Ứng phó thiên tai', 'vua'],
];
