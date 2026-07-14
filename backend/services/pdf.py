"""
PDF generation services
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.lib.units import mm


def generate_ticket_pdf(ticket: dict) -> BytesIO:
    """Generate a PDF ticket with QR code"""
    try:
        import qrcode
    except ImportError:
        qrcode = None

    buffer = BytesIO()
    ticket_width = 100 * mm
    ticket_height = 200 * mm
    p = canvas.Canvas(buffer, pagesize=(ticket_width, ticket_height))
    
    # Colors
    primary_green = HexColor("#00A651")
    dark_bg = HexColor("#0A0A0F")
    light_green_bg = HexColor("#E8F5E9")
    text_dark = HexColor("#1A1A1A")
    text_gray = HexColor("#666666")
    
    # ===== GREEN HEADER =====
    p.setFillColor(primary_green)
    p.rect(0, ticket_height - 25*mm, ticket_width, 25*mm, fill=True, stroke=False)
    
    # D-BILLET Logo text
    p.setFillColor(HexColor("#FFFFFF"))
    p.setFont("Helvetica-Bold", 18)
    p.drawString(10*mm, ticket_height - 16*mm, "D-BILLET")
    p.setFont("Helvetica", 8)
    p.drawString(10*mm, ticket_height - 21*mm, "Billetterie Djibouti")
    
    # ===== WHITE CONTENT AREA =====
    p.setFillColor(HexColor("#FFFFFF"))
    p.rect(5*mm, 10*mm, ticket_width - 10*mm, ticket_height - 40*mm, fill=True, stroke=False)
    
    # Add subtle border
    p.setStrokeColor(HexColor("#E0E0E0"))
    p.setLineWidth(0.5)
    p.rect(5*mm, 10*mm, ticket_width - 10*mm, ticket_height - 40*mm, fill=False, stroke=True)
    
    # ===== TICKET SUMMARY TITLE =====
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 14)
    p.drawCentredString(ticket_width/2, ticket_height - 45*mm, "Ticket Summary")
    
    # ===== TICKET DETAILS =====
    y_pos = ticket_height - 60*mm
    line_height = 12*mm
    
    def draw_info_row(label, value, y):
        p.setFillColor(text_gray)
        p.setFont("Helvetica", 9)
        p.drawString(12*mm, y, label)
        p.setFillColor(text_dark)
        p.setFont("Helvetica-Bold", 10)
        p.drawString(12*mm, y - 4*mm, str(value))
        return y - line_height
    
    # Event Title
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 11)
    event_title = ticket["event_title"]
    if len(event_title) > 35:
        event_title = event_title[:32] + "..."
    p.drawString(12*mm, y_pos, event_title)
    y_pos -= 8*mm
    
    # Ticket Type
    y_pos = draw_info_row("Type de billet:", ticket.get('ticket_type', 'Standard'), y_pos)
    
    # Date
    y_pos = draw_info_row("Date:", ticket['event_date'], y_pos)
    
    # Time
    y_pos = draw_info_row("Heure:", ticket['event_time'], y_pos)
    
    # Venue
    venue = ticket['event_venue']
    if len(venue) > 30:
        venue = venue[:27] + "..."
    y_pos = draw_info_row("Lieu:", venue, y_pos)
    
    # Passenger name (if exists - for train/ferry)
    if ticket.get('passenger_name'):
        y_pos = draw_info_row("Passager:", ticket['passenger_name'], y_pos)
    
    # Price
    y_pos = draw_info_row("Prix:", f"{ticket['price']} DJF", y_pos)
    
    # ===== QR CODE SECTION =====
    qr_y = 45*mm
    
    # "Scan to verify" text
    p.setFillColor(text_gray)
    p.setFont("Helvetica", 8)
    p.drawCentredString(ticket_width/2, qr_y + 38*mm, "Scan to verify")
    
    # QR Code
    qr_size = 30*mm
    if qrcode is not None:
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(ticket["qr_code_data"])
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")

        qr_buffer = BytesIO()
        qr_img.save(qr_buffer, format="PNG")
        qr_buffer.seek(0)

        qr_image = ImageReader(qr_buffer)
        p.drawImage(qr_image, (ticket_width - qr_size)/2, qr_y, qr_size, qr_size)
    else:
        p.setStrokeColor(HexColor("#222222"))
        p.rect((ticket_width - qr_size)/2, qr_y, qr_size, qr_size, fill=False, stroke=True)
        p.setFont("Helvetica", 7)
        p.drawCentredString(ticket_width/2, qr_y + qr_size/2, "QR indisponible")
    
    # "Scan QR Code" instruction
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 10)
    p.drawCentredString(ticket_width/2, qr_y - 6*mm, "Scan QR Code")
    
    # ===== PAYMENT REFERENCE (Light green box) =====
    p.setFillColor(light_green_bg)
    p.roundRect(10*mm, 12*mm, ticket_width - 20*mm, 12*mm, 2*mm, fill=True, stroke=False)
    
    p.setFillColor(text_gray)
    p.setFont("Helvetica", 8)
    p.drawString(15*mm, 19*mm, "Payment Reference No.:")
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 9)
    ref_number = ticket['id'].replace('-', '')[:13]
    p.drawString(55*mm, 19*mm, ref_number)
    
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer
