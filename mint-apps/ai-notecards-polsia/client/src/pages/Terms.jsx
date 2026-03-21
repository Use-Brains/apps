import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-[#1A1614] mb-2">Terms of Service</h1>
        <p className="text-sm text-[#6B635A] mb-8">Last Updated: March 14, 2026</p>

        <div className="prose prose-gray max-w-none text-[#1A1614] space-y-8">
          <p className="text-[#6B635A]">
            Welcome to AI Notecards. By accessing or using our service at ainotecards.com ("Service"), you agree
            to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">1. Account Responsibilities</h2>
            <p className="text-[#6B635A] leading-relaxed">
              You must provide accurate information when creating an account. You are limited to one account per
              person. You are responsible for maintaining the security of your account credentials, including any
              passwords you set. You must notify us immediately if you suspect unauthorized access to your account.
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">2. Marketplace Rules</h2>
            <p className="text-[#6B635A] leading-relaxed mb-3">
              The AI Notecards marketplace allows Pro subscribers to list and sell flashcard decks. By listing a deck,
              you agree to the following:
            </p>
            <ul className="list-disc pl-6 text-[#6B635A] space-y-2">
              <li>Deck prices must be between $1.00 and $5.00 USD.</li>
              <li>Decks must contain a minimum of 10 cards to be listed.</li>
              <li>You may have up to 50 active listings at any time.</li>
              <li>All content must be original or properly attributed. Plagiarized content will be removed.</li>
              <li>You are responsible for reviewing AI-generated content before listing. Ensure all cards are accurate, well-organized, and free of errors.</li>
              <li>Revenue is split 70% to the seller and 30% to the platform. Payouts are processed through Stripe Connect according to Stripe's payout schedule.</li>
              <li>Refunds and payment disputes are handled through Stripe's dispute resolution process.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">3. AI-Generated Content</h2>
            <p className="text-[#6B635A] leading-relaxed">
              AI Notecards uses artificial intelligence to generate flashcard content. While we strive for accuracy,
              AI-generated content may contain errors, inaccuracies, or outdated information. We make no guarantees
              regarding the correctness, completeness, or reliability of AI-generated content. You are solely
              responsible for reviewing, verifying, and editing all AI-generated content before use or sale. AI
              Notecards is not liable for any consequences arising from reliance on AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">4. Intellectual Property</h2>
            <p className="text-[#6B635A] leading-relaxed">
              You retain ownership of content you create or generate using the Service, including flashcard decks
              and their contents. When you list a deck on the marketplace, you grant AI Notecards a non-exclusive
              license to display and distribute that content to buyers. Buyers receive a personal-use license to
              study purchased decks. Buyers may not resell, redistribute, or republish purchased deck content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">5. Prohibited Content</h2>
            <p className="text-[#6B635A] leading-relaxed mb-3">
              You may not create, upload, or list content that:
            </p>
            <ul className="list-disc pl-6 text-[#6B635A] space-y-2">
              <li>Is sexually explicit, pornographic, or obscene</li>
              <li>Promotes hate speech, discrimination, or violence against individuals or groups</li>
              <li>Contains threats, harassment, or bullying</li>
              <li>Infringes on copyrights, trademarks, or other intellectual property rights</li>
              <li>Is spam, misleading, or fraudulent</li>
              <li>Violates any applicable laws or regulations</li>
            </ul>
            <p className="text-[#6B635A] leading-relaxed mt-3">
              We reserve the right to remove any content and suspend accounts that violate these guidelines without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">6. Payment Terms</h2>
            <p className="text-[#6B635A] leading-relaxed">
              All payments are processed securely through Stripe. We do not store your payment card information.
              Pro subscriptions are billed at $9.00 USD per month. You may cancel your subscription at any time, and
              you will retain access until the end of your current billing period. Marketplace purchases are
              one-time payments. The platform retains 30% of each sale as a service fee, and 70% is paid out to
              the seller via Stripe Connect. Payout timing is determined by Stripe's standard payout schedule for
              your region.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">7. Account Termination</h2>
            <p className="text-[#6B635A] leading-relaxed">
              We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity,
              or abuse the Service. Upon termination, your active marketplace listings will be delisted. You may
              delete your own account at any time through the Settings page. Account deletion is permanent: your
              personal information will be scrubbed and your data cannot be recovered.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">8. Limitation of Liability</h2>
            <p className="text-[#6B635A] leading-relaxed">
              AI Notecards is provided "as is" and "as available" without warranties of any kind, express or implied.
              To the maximum extent permitted by law, AI Notecards and its operators shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not limited to loss
              of profits, data, or use, arising out of or related to your use of the Service. Our total liability
              for any claim arising from or relating to these Terms or the Service shall not exceed the amount you
              paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">9. Changes to These Terms</h2>
            <p className="text-[#6B635A] leading-relaxed">
              We may update these Terms from time to time. When we make material changes, we will update the "Last
              Updated" date at the top of this page and may notify you via email or an in-app notice. Your continued
              use of the Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-3">10. Contact</h2>
            <p className="text-[#6B635A] leading-relaxed">
              If you have questions about these Terms, please contact us at{' '}
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
