'use client';
import React, { useState } from 'react';

// SVG Icons for Contact Details
const LocationIcon = () => (
  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
      clipRule="evenodd"
    />
  </svg>
);

const PhoneIcon = () => (
  <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
);

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setFormError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setSubmitted(true);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      setFormError(err.message || 'Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Banner Section */}
      <section className="relative h-[320px] w-full overflow-hidden bg-[#b81d1d] sm:h-[350px]">
        {/* Background Image/Pattern Overlay - Simulating the doctor image on the left */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-left opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1576091160550-2173ff3e5295?q=80&w=2070&auto=format)',
          }}
        ></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent to-[#b81d1d]"></div>

        <div className="site-container relative z-10 flex h-full items-center justify-end">
          <div data-aos="fade-left" className="max-w-xl text-right">
            <h1 className="mb-3 text-[34px] font-bold text-white sm:text-[40px] md:text-[52px]">
              Get in Touch
            </h1>
            <p className="text-[14px] font-medium leading-relaxed text-white/90 sm:text-[15px] md:text-[16px]">
              Have questions or need assistance? Our dedicated team is
              <br className="hidden md:block" />
              here to help you find the perfect vision solution.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="site-container py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Contact Form */}
          <div data-aos="fade-right" className="relative lg:col-span-5">
            <div className="relative z-20 -mt-16 rounded-[30px] border border-gray-50 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)] sm:-mt-20 sm:p-8 lg:-mt-24 lg:p-10">
              <h2 className="mb-8 text-[24px] font-bold text-[#1a1a1a]">Send us a message</h2>

              {submitted ? (
                <div className="space-y-4 py-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-8 w-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-[20px] font-bold text-[#1a1a1a]">Message Sent!</h3>
                  <p className="text-[14px] text-gray-500">
                    Thank you for reaching out. Our team will get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-2 text-[13px] font-semibold text-[#2A3182] hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {formError && (
                    <div className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                      {formError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-[#1a1a1a]">Full Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="Enter your name"
                        required
                        className="w-full rounded-[12px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] outline-none transition-all duration-300 hover:border-gray-300 focus:-translate-y-0.5 focus:border-[#2A3182] focus:shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-[#1a1a1a]">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="w-full rounded-[12px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] outline-none transition-all duration-300 hover:border-gray-300 focus:-translate-y-0.5 focus:border-[#2A3182] focus:shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-[#1a1a1a]">Phone Number</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="Enter your phone"
                        className="w-full rounded-[12px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] outline-none transition-all duration-300 hover:border-gray-300 focus:-translate-y-0.5 focus:border-[#2A3182] focus:shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-[#1a1a1a]">Subject</label>
                      <input
                        type="text"
                        value={form.subject}
                        onChange={(e) => updateField('subject', e.target.value)}
                        placeholder="Enter subject"
                        className="w-full rounded-[12px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] outline-none transition-all duration-300 hover:border-gray-300 focus:-translate-y-0.5 focus:border-[#2A3182] focus:shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#1a1a1a]">Message *</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => updateField('message', e.target.value)}
                      placeholder="Your message here..."
                      rows="4"
                      required
                      className="w-full resize-none rounded-[12px] border border-gray-200 bg-[#fdfdfd] px-4 py-3 text-[14px] outline-none transition-all duration-300 hover:border-gray-300 focus:-translate-y-0.5 focus:border-[#2A3182] focus:shadow-sm"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-4 w-full rounded-[12px] bg-[#353b93] py-3.5 text-[15px] font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2A3182] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Location & Contact */}
          <div data-aos="fade-left" className="pt-4 lg:col-span-7">
            <h2 className="mb-4 text-[28px] font-bold text-[#1a1a1a]">Location & Contact</h2>
            <p className="mb-10 max-w-xl text-[15px] font-medium leading-relaxed text-gray-500">
              Visit our showroom in Nairobi or contact us through any of our channels. We're always
              available to help.
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Card 1: Studio */}
              <div className="flex cursor-default items-start gap-4 rounded-[16px] border border-transparent bg-[#f8f9fa] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gray-100 hover:bg-white hover:shadow-md">
                <div className="mt-1">
                  <LocationIcon />
                </div>
                <div>
                  <h4 className="mb-1 text-[14px] font-bold text-[#1a1a1a]">Our Studio</h4>
                  <p className="text-[13px] font-medium leading-relaxed text-gray-500">
                    Optex House, Kimathi Street,
                    <br />
                    Nairobi CBD, Kenya 00100
                  </p>
                </div>
              </div>

              {/* Card 2: Phone */}
              <div className="flex cursor-default items-start gap-4 rounded-[16px] border border-transparent bg-[#f8f9fa] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gray-100 hover:bg-white hover:shadow-md">
                <div className="mt-1">
                  <PhoneIcon />
                </div>
                <div>
                  <h4 className="mb-1 text-[14px] font-bold text-[#1a1a1a]">Phone Support</h4>
                  <p className="text-[13px] font-medium text-gray-500">
                    +254 700 000 000
                    <br />
                    +254 722 000 000
                  </p>
                </div>
              </div>

              {/* Card 3: Email */}
              <div className="flex cursor-default items-start gap-4 rounded-[16px] border border-transparent bg-[#f8f9fa] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gray-100 hover:bg-white hover:shadow-md">
                <div className="mt-1">
                  <EmailIcon />
                </div>
                <div>
                  <h4 className="mb-1 text-[14px] font-bold text-[#1a1a1a]">Email Support</h4>
                  <p className="text-[13px] font-medium text-gray-500">optexopticians@gmail.com</p>
                </div>
              </div>

              {/* Card 4: Hours */}
              <div className="flex cursor-default items-start gap-4 rounded-[16px] border border-transparent bg-[#f8f9fa] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gray-100 hover:bg-white hover:shadow-md">
                <div className="mt-1">
                  <ClockIcon />
                </div>
                <div>
                  <h4 className="mb-1 text-[14px] font-bold text-[#1a1a1a]">Opening Hours</h4>
                  <p className="text-[13px] font-medium text-gray-500">
                    Mon - Sat: 9:00 AM - 8:00 PM
                    <br />
                    Sun: Closed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="mt-16 h-[320px] w-full overflow-hidden rounded-[24px] border border-gray-100 shadow-sm transition-all duration-500 hover:shadow-lg sm:h-[350px]">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.8176386773087!2d36.81600931475403!3d-1.2832533990647937!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f10d6640a2a05%3A0x9047f0c52cf4dc87!2sKimathi%20Street%2C%20Nairobi!5e0!3m2!1sen!2ske!4v1700000000000!5m2!1sen!2ske"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Map Location"
          ></iframe>
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return <Contact />;
}
