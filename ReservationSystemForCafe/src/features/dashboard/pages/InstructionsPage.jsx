import { useAuth } from '../../auth/useAuth'
import './InstructionsPage.css'

export default function InstructionsPage() {
  const { user } = useAuth()

  return (
    <div className="instructionsPage">
      <h2 className="pageTitle">Instructions & Guidelines</h2>

      {/* Section 1: Reservation Process */}
      <section className="instructionsSection">
        <h3 className="instructionsSection__title">Reservation Process</h3>
        <div className="instructionsCard">
          <ol className="instructionsList">
            <li>
              <strong>Select Date & Time:</strong> Choose your preferred date and start time from the reservation page. Time slots are available in 30-minute increments.
            </li>
            <li>
              <strong>Choose Party Size:</strong> Select the number of guests in your party. Must be between 1 and the table capacity.
            </li>
            <li>
              <strong>Pick a Table:</strong> Browse available tables on the floor map or timeline. Each table shows capacity and special features.
            </li>
            <li>
              <strong>Enter Contact Information:</strong> Provide your name, phone number, and email. This helps us confirm your reservation.
            </li>
            <li>
              <strong>Submit Reservation:</strong> Click "Reaverve" to submit your hold request. Your reservation will be pending confirmation.
            </li>
            <li>
              <strong>Confirmation Call:</strong> Our staff will call you to confirm your reservation.
            </li>
            <li>
              <strong>Final Confirmation:</strong> Once confirmed by phone, your reservation is confirmed. You'll receive a confirmation message.
            </li>
          </ol>
        </div>
      </section>

      {/* Anonymous User Notice */}
      {user?.isAnonymous && (
        <section className="instructionsSection">
          <div className="instructionsCard warningBox">
            <h4>Guest Reservations</h4>
            <p>You're currently booking as a guest. Booking history is not available for guest accounts. To access your reservation history and enjoy exclusive benefits, please <strong>create an account</strong> with us.</p>
          </div>
        </section>
      )}

      {/* Section 2: Important Notes */}
      <section className="instructionsSection">
        <h3 className="instructionsSection__title">Important Notes</h3>
        <div className="instructionsCard">
          <ul className="guidelinesList">
            <li>
              <strong className="highlight">Hold Duration:</strong> Reservations are held after you reserve. During this time, staff will contact you for confirmation.
            </li>
            <li>
              <strong className="highlight">Max Duration:</strong> Maximum reservation duration is 6 hours per booking.
            </li>
            <li>
              <strong className="highlight">Cancellation:</strong> You can cancel your reservation anytime through the booking history. Confirmed reservations must be cancelled at least 1 hour before your scheduled time.
            </li>
            <li>
              <strong className="highlight">Check-in Window:</strong> You can check in up to 10 minutes before your scheduled start time. Late arrivals may forfeit your reservation.
            </li>
          </ul>
        </div>
      </section>

      {/* Section 3: Table Features */}
      <section className="instructionsSection">
        <h3 className="instructionsSection__title">Table Features & Amenities</h3>
        <div className="instructionsCard">
          <div className="featureGrid">
            <div className="featureItem">
              <div className="featureLabel">Quiet Zone</div>
              <p className="featureSub">Peaceful corner, perfect for conversations or work</p>
            </div>
            <div className="featureItem">
              <div className="featureLabel">Photo Spot</div>
              <p className="featureSub">Instagram-worthy location with great natural light</p>
            </div>
            <div className="featureItem">
              <div className="featureLabel">Power Outlets</div>
              <p className="featureSub">Convenient charging station available at this table</p>
            </div>
            <div className="featureItem">
              <div className="featureLabel">Multiple Floors</div>
              <p className="featureSub">Choose your preferred floor level when booking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Before You Visit */}
      <section className="instructionsSection">
        <h3 className="instructionsSection__title">Before You Visit</h3>
        <div className="instructionsCard">
          <ul className="checklistList">
            <li>Confirm your reservation details via phone call from our staff</li>
            <li>Have your confirmation details or phone number ready</li>
            <li>Inform us of any dietary restrictions or allergies</li>
          </ul>
        </div>
      </section>

      {/* Section 5: FAQ */}
      <section className="instructionsSection">
        <h3 className="instructionsSection__title">Frequently Asked Questions</h3>
        <div className="instructionsCard">
          <div className="faqItem">
            <h4 className="faqQuestion">Can I modify my reservation after booking?</h4>
            <p className="faqAnswer">Yes, you can modify your reservation before staff confirms it. After confirmation, please call us directly for changes.</p>
          </div>
          <div className="faqItem">
            <h4 className="faqQuestion">What if I miss my reservation time?</h4>
            <p className="faqAnswer">Please arrive within 30 minutes of your start time.</p>
          </div>
          <div className="faqItem">
            <h4 className="faqQuestion">Can I extend my reservation?</h4>
            <p className="faqAnswer">Extensions depend on availability. Contact staff when you check in or call ahead. Additional charges may apply.</p>
          </div>
          <div className="faqItem">
            <h4 className="faqQuestion">Do you accept walk-in customers?</h4>
            <p className="faqAnswer">Yes! Walk-ins are welcome based on table availability.</p>
          </div>
          <div className="faqItem">
            <h4 className="faqQuestion">Is there a minimum spending requirement?</h4>
            <p className="faqAnswer">We operate on a per-table basis. No minimum spending required, but we appreciate your patronage.</p>
          </div>
        </div>
      </section>

      {/* Section 6: Booking History - Only for authenticated users */}
      {!user?.isAnonymous && (
        <section className="instructionsSection">
          <h3 className="instructionsSection__title">Your Booking History</h3>
          <div className="instructionsCard infoBox">
            <p>You can view and manage all your past and upcoming reservations in the <strong>Reservation</strong> section of your dashboard.</p>
            <ul className="quickLinks">
              <li>View all your reservations</li>
              <li>Cancel upcoming bookings</li>
              <li>Track reservation status</li>
            </ul>
          </div>
        </section>
      )}

      {/* Contact Info */}
      <section className="instructionsSection">
        <h3 className="instructionsSection__title">Need Help?</h3>
        <div className="instructionsCard">
          <p className="contactInfo">
            If you have any questions about your reservation or need assistance, please contact us:
          </p>
          <div className="contactDetails">
            <p><strong>Phone:</strong> +84 (0)XX XXX XXXX</p>
            <p><strong>Email:</strong> support@cafe.example.com</p>
            <p><strong>Hours:</strong> Daily 8:00 AM - 11:00 PM</p>
          </div>
        </div>
      </section>
    </div>
  )
}
