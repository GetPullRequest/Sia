"use client";
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card py-8 border-b border-slate-800">
        <div className="container mx-auto px-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-text/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text">Privacy Policy</h1>
          <p className="text-text/70 mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="bg-card rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 lg:p-12 space-y-8">

          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Introduction</h2>
          <p className="text-text/70 leading-relaxed break-words">
            GetPullRequest ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered development assistant service.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Information We Collect</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Personal Information</h3>
              <p className="text-text/70 leading-relaxed">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside text-text/70 mt-2 space-y-1 ml-4">
                <li>Name and email address</li>
                <li>Account credentials</li>
                <li>Communication preferences</li>
                <li>Payment information (processed securely through third-party providers)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Usage Information</h3>
              <p className="text-text/70 leading-relaxed">
                We automatically collect certain information about your use of our service:
              </p>
              <ul className="list-disc list-inside text-text/70 leading-relaxed mt-2 space-y-1 ml-4">
                <li>Log data and device information</li>
                <li>Usage patterns and feature interactions</li>
                <li>Performance metrics and error reports</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Code and Repository Information</h3>
              <p className="text-text/70 leading-relaxed">
                To provide our service, we process:
              </p>
              <ul className="list-disc list-inside text-text/70 leading-relaxed mt-2 space-y-1 ml-4">
                <li>Repository metadata and structure</li>
                <li>Code content for analysis and PR generation</li>
                <li>Task descriptions and instructions</li>
                <li>Pull request history and review feedback</li>
              </ul>
            </div>
          </div>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">How We Use Your Information</h2>
          <p className="text-text/70 leading-relaxed mb-4 break-words">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>Provide, maintain, and improve our AI development assistant service</li>
            <li>Generate pull requests and implement code changes as requested</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices, updates, and security alerts</li>
            <li>Respond to your comments, questions, and customer service requests</li>
            <li>Monitor and analyze usage trends and preferences</li>
            <li>Detect, prevent, and address technical issues and security vulnerabilities</li>
          </ul>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Data Security</h2>
          <p className="text-text/70 leading-relaxed">
            We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. This includes:
          </p>
          <ul className="list-disc list-inside text-text/70 mt-2 space-y-1 ml-4">
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments and updates</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Secure coding practices and code review processes</li>
          </ul>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Data Sharing and Disclosure</h2>
          <p className="text-text/70 leading-relaxed mb-4 break-words">
            We do not sell your personal information. We may share your information only in the following circumstances:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>With your consent or at your direction</li>
            <li>With service providers who perform services on our behalf</li>
            <li>To comply with legal obligations or respond to lawful requests</li>
            <li>To protect our rights, privacy, safety, or property</li>
            <li>In connection with a merger, acquisition, or sale of assets</li>
          </ul>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Your Rights and Choices</h2>
          <p className="text-text/70 leading-relaxed mb-4 break-words">
            You have certain rights regarding your personal information:
          </p>
          <ul className="list-disc list-inside text-text/70 space-y-2 ml-4">
            <li>Access and receive a copy of your personal information</li>
            <li>Correct or update inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to or restrict certain processing activities</li>
            <li>Opt out of marketing communications</li>
            <li>Export your data in a portable format</li>
          </ul>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Data Retention</h2>
          <p className="text-text/70 leading-relaxed">
            We retain your information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy. We will delete or anonymize your information when it is no longer needed, unless we are required to retain it for legal or compliance purposes.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Third-Party Integrations</h2>
          <p className="text-text/70 leading-relaxed">
            Our service integrates with third-party platforms (e.g., GitHub, Slack, Discord). When you connect these integrations, you authorize us to access certain information from these platforms as permitted by their terms and your privacy settings. We recommend reviewing the privacy policies of these third-party services.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Children's Privacy</h2>
          <p className="text-text/70 leading-relaxed">
            Our service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">International Data Transfers</h2>
          <p className="text-text/70 leading-relaxed">
            Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Changes to This Privacy Policy</h2>
          <p className="text-text/70 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>



          <h2 className="text-xl sm:text-2xl font-bold text-text mb-4">Contact Us</h2>
          <p className="text-text/70 leading-relaxed">
            If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
          </p>
          <div className="mt-4 p-4 bg-card rounded-lg">
            <p className="text-text font-medium">Email: privacy@getpullrequest.com</p>
            <p className="text-text/70 mt-1">Support: support@getpullrequest.com</p>
          </div>

        </div>
      </div>
    </div>
  );
}
