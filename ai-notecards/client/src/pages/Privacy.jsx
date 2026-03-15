import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-[#1A1614] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#6B635A] mb-8">Last Updated: March 14, 2026</p>

        <div className="prose prose-gray max-w-none text-[#1A1614] space-y-8">
          <p className="text-[#6B635A]">
            AI Notecards ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, and safeguard your information when you use our service at
            ainotecards.com ("Service").
          </p>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">1. Data We Collect</h2>
            <p className="text-[#6B635A] leading-relaxed mb-3">
              We collect the following types of information:
            </p>
            <ul className="list-disc pl-6 text-[#6B635A] space-y-2">
              <li><strong>Account information:</strong> Email address, display name, and authentication method (email/password, Google, or magic link).</li>
              <li><strong>Study data:</strong> Flashcard decks you create or purchase, study session history, progress scores, and preferences.</li>
              <li><strong>Payment information:</strong> Payment processing is handled entirely by Stripe. We do not store your credit card number, bank account details, or other financial information on our servers. We store only your Stripe customer ID and subscription status.</li>
              <li><strong>Usage data:</strong> Basic usage patterns such as login timestamps and feature usage to improve the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 text-[#6B635A] space-y-2">
              <li><strong>Account management:</strong> To create and maintain your account, authenticate your identity, and manage your subscription.</li>
              <li><strong>AI generation:</strong> To process your input text and generate flashcard content. Your input is sent to our AI providers for processing and is not stored by them beyond the request.</li>
              <li><strong>Study tracking:</strong> To track your study progress, streaks, and scores across sessions.</li>
              <li><strong>Marketplace operations:</strong> To facilitate deck listings, purchases, ratings, and seller payouts.</li>
              <li><strong>Service improvement:</strong> To understand how the Service is used and to improve functionality and user experience.</li>
              <li><strong>Communication:</strong> To send you transactional emails (e.g., magic link codes) and, if you opt in, study reminders and marketplace activity notifications.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">3. Third-Party Services</h2>
            <p className="text-[#6B635A] leading-relaxed mb-3">
              We use the following third-party services to operate the platform:
            </p>
            <ul className="list-disc pl-6 text-[#6B635A] space-y-2">
              <li><strong>Stripe</strong> — Payment processing for subscriptions and marketplace purchases. Stripe's privacy policy applies to payment data. <a href="https://stripe.com/privacy" className="text-[#1B6B5A] hover:underline" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a></li>
              <li><strong>Supabase</strong> — Database hosting and file storage. Your data is stored securely on Supabase's infrastructure. <a href="https://supabase.com/privacy" className="text-[#1B6B5A] hover:underline" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a></li>
              <li><strong>Groq / Google Gemini</strong> — AI providers for flashcard generation. Your input text is sent to these services for processing. They do not retain your data beyond the API request.</li>
              <li><strong>Resend</strong> — Email delivery for magic link codes and notifications. <a href="https://resend.com/legal/privacy-policy" className="text-[#1B6B5A] hover:underline" target="_blank" rel="noopener noreferrer">resend.com/legal/privacy-policy</a></li>
              <li><strong>Sentry</strong> — Error monitoring and crash reporting. Sentry receives anonymized error data (user ID only, no email or personal information) to help us identify and fix bugs. <a href="https://sentry.io/privacy/" className="text-[#1B6B5A] hover:underline" target="_blank" rel="noopener noreferrer">sentry.io/privacy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">4. Data Retention</h2>
            <p className="text-[#6B635A] leading-relaxed">
              We retain your account data for as long as your account is active. If you delete your account, we
              perform a soft-delete that immediately scrubs all personally identifiable information (email, display
              name, avatar, payment IDs, Google account link) and resets behavioral data (study sessions, streaks,
              scores). The scrubbed record is retained for a limited period for fraud prevention and legal
              compliance, after which it may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">5. Your Rights</h2>
            <p className="text-[#6B635A] leading-relaxed mb-3">
              You have the following rights regarding your data:
            </p>
            <ul className="list-disc pl-6 text-[#6B635A] space-y-2">
              <li><strong>Access:</strong> You can view your account information and study data at any time through the Settings page.</li>
              <li><strong>Export:</strong> You can download all your decks and flashcards as a JSON file from Settings &gt; Data &amp; Privacy.</li>
              <li><strong>Deletion:</strong> You can permanently delete your account and all associated data from Settings &gt; Data &amp; Privacy.</li>
              <li><strong>Correction:</strong> You can update your display name, email, and other profile information through the Settings page.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">6. Cookies</h2>
            <p className="text-[#6B635A] leading-relaxed">
              We use a single httpOnly cookie to maintain your login session (JWT authentication token). This cookie
              is essential for the Service to function and cannot be disabled. We do not use tracking cookies,
              advertising cookies, or third-party analytics cookies. We do not use any cookie-based tracking or
              behavioral advertising services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">7. Children's Privacy</h2>
            <p className="text-[#6B635A] leading-relaxed">
              AI Notecards is not directed at children under the age of 13. We do not knowingly collect personal
              information from children under 13. If we learn that we have collected personal information from a
              child under 13, we will take steps to delete that information promptly. If you believe a child under
              13 has provided us with personal information, please contact us at{' '}
              <a href="mailto:support@ainotecards.com" className="text-[#1B6B5A] hover:underline">
                support@ainotecards.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">8. Do Not Sell My Personal Information</h2>
            <p className="text-[#6B635A] leading-relaxed">
              We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
              We do not participate in data broker networks or share your information for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">9. Changes to This Policy</h2>
            <p className="text-[#6B635A] leading-relaxed">
              We may update this Privacy Policy from time to time. When we make material changes, we will update the
              "Last Updated" date at the top of this page and may notify you via email or an in-app notice. We
              encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">10. Contact</h2>
            <p className="text-[#6B635A] leading-relaxed">
              If you have questions about this Privacy Policy or your data, please contact us at{' '}
              <a href="mailto:support@ainotecards.com" className="text-[#1B6B5A] hover:underline">
                support@ainotecards.com
              </a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
