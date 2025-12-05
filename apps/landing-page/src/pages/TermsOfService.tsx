import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card py-8 border-b border-slate-800">
        <div className="container mx-auto px-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-text/70 hover:text-text transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text">Terms of Service</h1>
          <p className="text-text/70 mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="bg-card rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 lg:p-12 space-y-8">

          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Agreement to Terms</h2>
          <p className="text-text/70 leading-relaxed">
            By accessing or using GetPullRequest ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not access or use the Service. We reserve the right to modify these Terms at any time, and your continued use of the Service constitutes acceptance of any changes.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Description of Service</h2>
          <p className="text-text/70 leading-relaxed mb-4">
            GetPullRequest is an AI-powered development assistant that:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>Accepts coding task assignments via messaging platforms</li>
            <li>Analyzes repository code and implements requested changes</li>
            <li>Creates pull requests with completed code implementations</li>
            <li>Runs tests and ensures code quality</li>
            <li>Integrates with development tools and platforms</li>
          </ul>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">User Accounts</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Account Registration</h3>
              <p className="text-text/70 leading-relaxed">
                You must create an account to use the Service. You agree to:
              </p>
              <ul className="list-disc list-inside text-text/70 mt-2 space-y-1 ml-4">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Account Requirements</h3>
              <p className="text-text/70 leading-relaxed">
                You must be at least 13 years old to use the Service. By creating an account, you represent that you meet this requirement and have the authority to enter into these Terms.
              </p>
            </div>
          </div>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Acceptable Use</h2>
          <p className="text-text/70 leading-relaxed mb-4">
            You agree not to:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>Violate any applicable laws, regulations, or third-party rights</li>
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>Attempt to gain unauthorized access to our systems or networks</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Transmit viruses, malware, or other malicious code</li>
            <li>Reverse engineer, decompile, or disassemble the Service</li>
            <li>Use the Service to create competing products or services</li>
            <li>Share your account credentials with others</li>
            <li>Scrape or harvest data from the Service without permission</li>
          </ul>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Code and Intellectual Property</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Your Code</h3>
              <p className="text-text/70 leading-relaxed">
                You retain all ownership rights to your code and repositories. By using the Service, you grant us a limited license to access, process, and modify your code solely to provide the Service.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Generated Code</h3>
              <p className="text-text/70 leading-relaxed">
                Code generated by our AI assistant is provided to you under the same license as your repository. You are responsible for reviewing and testing all generated code before merging.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Our Service</h3>
              <p className="text-text/70 leading-relaxed">
                The Service, including its design, features, algorithms, and all related intellectual property, is owned by GetPullRequest and is protected by copyright, trademark, and other laws.
              </p>
            </div>
          </div>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Payment and Billing</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Subscription Plans</h3>
              <p className="text-text/70 leading-relaxed">
                The Service is offered through various subscription plans. You agree to pay all fees associated with your selected plan. Fees are billed in advance on a recurring basis.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Cancellation and Refunds</h3>
              <p className="text-text/70 leading-relaxed">
                You may cancel your subscription at any time. Cancellations take effect at the end of the current billing period. We do not provide refunds for partial months or unused services, except as required by law.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Price Changes</h3>
              <p className="text-text/70 leading-relaxed">
                We reserve the right to change our pricing. We will provide reasonable notice of any price increases, and you will have the opportunity to cancel before the new prices take effect.
              </p>
            </div>
          </div>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Service Availability</h2>
          <p className="text-text/70 leading-relaxed">
            We strive to provide reliable service but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We are not liable for any losses resulting from Service unavailability.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Disclaimers and Warranties</h2>
          <p className="text-text/70 leading-relaxed mb-4">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>Warranties of merchantability and fitness for a particular purpose</li>
            <li>Warranties that the Service will be error-free or uninterrupted</li>
            <li>Warranties regarding the accuracy or reliability of AI-generated code</li>
            <li>Warranties that the Service will meet your specific requirements</li>
          </ul>
          <p className="text-text/70 leading-relaxed mt-4">
            You are responsible for reviewing, testing, and validating all code generated by the Service before deployment.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Limitation of Liability</h2>
          <p className="text-text/70 leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Indemnification</h2>
          <p className="text-text/70 leading-relaxed">
            You agree to indemnify and hold harmless GetPullRequest, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the Service, violation of these Terms, or infringement of any rights of another party.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Third-Party Services</h2>
          <p className="text-text/70 leading-relaxed">
            The Service integrates with third-party platforms (e.g., GitHub, Slack, Discord). Your use of these integrations is subject to the respective third party's terms and policies. We are not responsible for the availability, content, or practices of these third-party services.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Termination</h2>
          <p className="text-text/70 leading-relaxed mb-4">
            We may suspend or terminate your access to the Service at any time, with or without cause, including if:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>You violate these Terms</li>
            <li>Your account has been inactive for an extended period</li>
            <li>We discontinue the Service or any part thereof</li>
            <li>Required by law or court order</li>
          </ul>
          <p className="text-text/70 leading-relaxed mt-4">
            Upon termination, your right to use the Service will cease immediately, and we may delete your account and data.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Governing Law and Disputes</h2>
          <p className="text-text/70 leading-relaxed">
            These Terms are governed by the laws of the jurisdiction in which GetPullRequest is registered, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, except where prohibited by law.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">General Provisions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Entire Agreement</h3>
              <p className="text-text/70 leading-relaxed">
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and GetPullRequest regarding the Service.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Severability</h3>
              <p className="text-text/70 leading-relaxed">
                If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Waiver</h3>
              <p className="text-text/70 leading-relaxed">
                Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Assignment</h3>
              <p className="text-text/70 leading-relaxed">
                You may not assign or transfer these Terms without our prior written consent. We may assign these Terms without restriction.
              </p>
            </div>
          </div>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Contact Information</h2>
          <p className="text-text/70 leading-relaxed">
            If you have any questions about these Terms, please contact us at:
          </p>
          <div className="mt-4 p-4 bg-card rounded-lg">
            <p className="text-text font-medium">Email: legal@getpullrequest.com</p>
            <p className="text-text/70 mt-1">Support: support@getpullrequest.com</p>
          </div>

        </div>
      </div>
    </div>
  );
}
