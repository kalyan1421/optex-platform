'use client';
import React, { useState } from 'react';
import { api } from '../../lib/api';
import { buildMapUrl } from '../../lib/maps';

// Optex Opticians headquarters, per the client (2026-08-20). Single copy so
// the visible address and the embedded map can't drift apart. No lat/lng on
// file for this address — buildMapUrl() falls back to geocoding the address
// text itself, which is more accurate than a guessed coordinate pair.
const MAIN_BRANCH = {
  address: "Krishna Park, next to Doctor's Park, 3rd Parklands, Nairobi, Kenya",
};

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
  <svg
    className="h-5 w-5 text-gray-500 lg:h-[24px] lg:w-[24px]"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19.95 21C17.8667 21 15.8083 20.5458 13.775 19.6375C11.7417 18.7292 9.89167 17.525 8.225 16.025C6.55833 14.525 5.225 12.8333 4.225 10.95C3.225 9.06667 2.725 7.125 2.725 5.125C2.725 4.80833 2.8375 4.5375 3.0625 4.3125C3.2875 4.0875 3.56667 3.975 3.9 3.975H7.9C8.16667 3.975 8.4 4.0625 8.6 4.2375C8.8 4.4125 8.93333 4.63333 9 4.9L9.75 8.4C9.8 8.65 9.77917 8.875 9.6875 9.075C9.59583 9.275 9.43333 9.43333 9.2 9.55L6.675 12.075C7.30833 13.275 8.08333 14.3833 9 15.4C9.91667 16.4167 10.95 17.2833 12.1 18L14.525 15.575C14.7083 15.3917 14.9292 15.2625 15.1875 15.1875C15.4458 15.1125 15.6833 15.1167 15.9 15.2L19.35 15.975C19.65 16.0417 19.8792 16.1875 20.0375 16.4125C20.1958 16.6375 20.275 16.8833 20.275 17.15V20.05C20.275 20.3167 20.175 20.5458 19.975 20.7375C19.775 20.9292 19.5333 21.0167 19.25 21C19.4833 21 19.7167 21 19.95 21Z"
      fill="currentColor"
    />
  </svg>
);

const EmailIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400 lg:h-[24px] lg:w-[24px]"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 20C3.45 20 2.97917 19.8042 2.5875 19.4125C2.19583 19.0208 2 18.55 2 18V6C2 5.45 2.19583 4.97917 2.5875 4.5875C2.97917 4.19583 3.45 4 4 4H20C20.55 4 21.0208 4.19583 21.4125 4.5875C21.8042 4.97917 22 5.45 22 6V18C22 18.55 21.8042 19.0208 21.4125 19.4125C21.0208 19.8042 20.55 20 20 20H4ZM12 13L4 8V18H20V8L12 13ZM12 11L20 6H4L12 11ZM4 8V6V18V8Z"
      fill="currentColor"
    />
  </svg>
);

const ClockIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400 lg:h-[24px] lg:w-[24px]"
    fill="none"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.95 22C10.5667 22 9.26667 21.7375 8.05 21.2125C6.83333 20.6875 5.775 19.975 4.875 19.075C3.975 18.175 3.2625 17.1167 2.7375 15.9C2.2125 14.6833 1.95 13.3833 1.95 12C1.95 10.6167 2.2125 9.31667 2.7375 8.1C3.2625 6.88333 3.975 5.825 4.875 4.925C5.775 4.025 6.83333 3.3125 8.05 2.7875C9.26667 2.2625 10.5667 2 11.95 2C13.3333 2 14.6333 2.2625 15.85 2.7875C17.0667 3.3125 18.125 4.025 19.025 4.925C19.925 5.825 20.6375 6.88333 21.1625 8.1C21.6875 9.31667 21.95 10.6167 21.95 12C21.95 13.3833 21.6875 14.6833 21.1625 15.9C20.6375 17.1167 19.925 18.175 19.025 19.075C18.125 19.975 17.0667 20.6875 15.85 21.2125C14.6333 21.7375 13.3333 22 11.95 22ZM11.95 20C14.1833 20 16.075 19.225 17.625 17.675C19.175 16.125 19.95 14.2333 19.95 12C19.95 9.76667 19.175 7.875 17.625 6.325C16.075 4.775 14.1833 4 11.95 4C9.71667 4 7.825 4.775 6.275 6.325C4.725 7.875 3.95 9.76667 3.95 12C3.95 14.2333 4.725 16.125 6.275 17.675C7.825 19.225 9.71667 20 11.95 20ZM10.95 13H15.95V11H12.95V7H10.95V13Z"
      fill="currentColor"
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
      await api.contact.submit(form);
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
      <section className="relative flex w-full flex-col items-end justify-center overflow-hidden bg-[#E53935] px-6 py-12 sm:px-10 sm:py-16 lg:h-[354px] lg:px-0 lg:py-0 lg:pr-[100px]">
        {/* Background Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/contact-background.png)' }}
        />

        {/* Content Box */}
        <div className="relative z-10 flex w-full min-w-0 flex-col items-end gap-3 lg:h-[152px] lg:w-[511px] lg:gap-[14px]">
          <h1
            className="flex items-center justify-end text-right text-[#FFFFFF] lg:h-[84px] lg:w-[357px]"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(32px, 8vw, 56px)',
              lineHeight: 1.3,
            }}
          >
            Get in Touch
          </h1>
          <p
            className="flex items-center justify-end text-right text-[#FFFFFFCC] lg:h-[54px] lg:w-[511px]"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(14px, 3.2vw, 18px)',
              lineHeight: 1.5,
            }}
          >
            Have questions or need assistance? Our dedicated team is here to help you find the
            perfect vision solution.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col px-6 lg:px-[100px] lg:pb-[80px] lg:pt-[80px]">
        <div className="flex flex-col gap-12 lg:w-[1240px] lg:flex-row lg:gap-[80px]">
          {/* Left Column: Contact Form */}
          <div
            data-aos="fade-right"
            className="flex shrink-0 flex-col bg-white lg:h-[639.6px] lg:w-[533.6px] lg:gap-[32px] lg:rounded-[32px] lg:p-[48px]"
            style={{
              border: '0.8px solid #F3F4F6',
              boxShadow: '0px 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <h2
              className="text-[#000000] lg:h-[48px] lg:w-[436px]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '32px',
                lineHeight: '48px',
              }}
            >
              Send us a message
            </h2>

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
                  className="mt-2 text-[13px] font-semibold text-[#2E3192] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col lg:h-[462.8px] lg:w-[436px] lg:gap-[24px]"
              >
                {formError && (
                  <div className="rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                    {formError}
                  </div>
                )}

                {/* Row 1: Name & Email */}
                <div className="flex flex-col gap-6 lg:h-[78.6px] lg:w-[436px] lg:flex-row lg:gap-[24px]">
                  {/* Full Name */}
                  <div className="flex flex-col lg:h-[78.6px] lg:w-[206px] lg:gap-[8px]">
                    <label
                      className="text-[#000000] lg:h-[21px]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        fontSize: '14px',
                        lineHeight: '21px',
                      }}
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Enter your name"
                      required
                      className="w-full bg-white outline-none transition-colors placeholder:text-[#0A0A0A80] focus:border-[#2A3182] lg:h-[49.6px] lg:px-[16px] lg:py-[12px]"
                      style={{
                        borderRadius: '14px',
                        border: '0.8px solid #E5E7EB',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                      }}
                    />
                  </div>
                  {/* Email */}
                  <div className="flex flex-col lg:h-[78.6px] lg:w-[206px] lg:gap-[8px]">
                    <label
                      className="text-[#000000] lg:h-[21px]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        fontSize: '14px',
                        lineHeight: '21px',
                      }}
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full bg-white outline-none transition-colors placeholder:text-[#0A0A0A80] focus:border-[#2A3182] lg:h-[49.6px] lg:px-[16px] lg:py-[12px]"
                      style={{
                        borderRadius: '14px',
                        border: '0.8px solid #E5E7EB',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: Phone & Subject */}
                <div className="flex flex-col gap-6 lg:h-[78.6px] lg:w-[436px] lg:flex-row lg:gap-[24px]">
                  {/* Phone */}
                  <div className="flex flex-col lg:h-[78.6px] lg:w-[206px] lg:gap-[8px]">
                    <label
                      className="text-[#000000] lg:h-[21px]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        fontSize: '14px',
                        lineHeight: '21px',
                      }}
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="Enter your phone"
                      className="w-full bg-white outline-none transition-colors placeholder:text-[#0A0A0A80] focus:border-[#2A3182] lg:h-[49.6px] lg:px-[16px] lg:py-[12px]"
                      style={{
                        borderRadius: '14px',
                        border: '0.8px solid #E5E7EB',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                      }}
                    />
                  </div>
                  {/* Subject */}
                  <div className="flex flex-col lg:h-[78.6px] lg:w-[206px] lg:gap-[8px]">
                    <label
                      className="text-[#000000] lg:h-[21px]"
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        fontSize: '14px',
                        lineHeight: '21px',
                      }}
                    >
                      Subject
                    </label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => updateField('subject', e.target.value)}
                      placeholder="Enter subject"
                      className="w-full bg-white outline-none transition-colors placeholder:text-[#0A0A0A80] focus:border-[#2A3182] lg:h-[49.6px] lg:px-[16px] lg:py-[12px]"
                      style={{
                        borderRadius: '14px',
                        border: '0.8px solid #E5E7EB',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                      }}
                    />
                  </div>
                </div>

                {/* Message */}
                <div className="flex flex-col lg:h-[174.6px] lg:w-[436px] lg:gap-[8px]">
                  <label
                    className="text-[#000000] lg:h-[21px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '14px',
                      lineHeight: '21px',
                    }}
                  >
                    Message
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    placeholder="Your message here..."
                    required
                    className="w-full resize-none bg-white outline-none transition-colors placeholder:text-[#0A0A0A80] focus:border-[#2A3182] lg:h-[145.6px] lg:px-[16px] lg:py-[12px]"
                    style={{
                      borderRadius: '14px',
                      border: '0.8px solid #E5E7EB',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '16px',
                    }}
                  />
                </div>

                {/* Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex shrink-0 items-center justify-center bg-[#2E3192] text-white transition-opacity hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 lg:h-[59px] lg:w-[436px] lg:py-[16px]"
                  style={{ borderRadius: '14px' }}
                >
                  <span
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 700,
                      fontSize: '18px',
                      lineHeight: '27px',
                    }}
                  >
                    {submitting ? 'Sending...' : 'Send Message'}
                  </span>
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Location & Contact */}
          <div data-aos="fade-left" className="flex shrink-0 flex-col lg:w-[533.6px] lg:pt-[40px]">
            <h2
              className="text-[#000000] lg:h-[48px] lg:w-[533.6px]"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '32px',
                lineHeight: '48px',
              }}
            >
              Location & Contact
            </h2>
            <p
              className="text-[#717182] lg:mt-[16px] lg:h-[58.5px] lg:w-[533.6px]"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: '29.25px',
              }}
            >
              Visit our showroom in Nairobi or contact us through any of our channels. We're always
              available to help.
            </p>

            <div className="flex flex-col lg:mt-[32px] lg:h-[450.4px] lg:w-[533.6px] lg:gap-[24px]">
              {/* Card 1: Studio */}
              <div
                className="flex items-center bg-[#F9FAFB] lg:h-[94.6px] lg:w-[533.6px] lg:gap-[16px] lg:p-[24px]"
                style={{ borderRadius: '16px', border: '0.8px solid #E5E7EB' }}
              >
                <div className="flex items-center justify-center text-[24px] lg:h-[45px] lg:w-[33px]">
                  📍
                </div>
                <div className="flex flex-col lg:h-[45px]">
                  <h4
                    className="text-[#000000] lg:h-[24px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      lineHeight: '24px',
                    }}
                  >
                    Our Studio
                  </h4>
                  <p
                    className="text-[#717182] lg:h-[21px]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                    }}
                  >
                    {MAIN_BRANCH.address}
                  </p>
                </div>
              </div>

              {/* Card 2: Phone */}
              <div
                className="flex items-center bg-[#F9FAFB] lg:h-[94.6px] lg:w-[533.6px] lg:gap-[16px] lg:p-[24px]"
                style={{ borderRadius: '16px', border: '0.8px solid #E5E7EB' }}
              >
                <div className="flex items-center justify-center lg:h-[45px] lg:w-[33px]">
                  <PhoneIcon />
                </div>
                <div className="flex flex-col lg:h-[45px]">
                  <h4
                    className="text-[#000000] lg:h-[24px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      lineHeight: '24px',
                    }}
                  >
                    Phone Support
                  </h4>
                  <p
                    className="text-[#717182] lg:h-[21px]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                    }}
                  >
                    +254 700 897 007 / +254 704 520 201
                  </p>
                </div>
              </div>

              {/* Card 3: Email */}
              <div
                className="flex items-center bg-[#F9FAFB] lg:h-[94.6px] lg:w-[533.6px] lg:gap-[16px] lg:p-[24px]"
                style={{ borderRadius: '16px', border: '0.8px solid #E5E7EB' }}
              >
                <div className="flex items-center justify-center lg:h-[45px] lg:w-[33px]">
                  <EmailIcon />
                </div>
                <div className="flex flex-col lg:h-[45px]">
                  <h4
                    className="text-[#000000] lg:h-[24px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      lineHeight: '24px',
                    }}
                  >
                    Email Support
                  </h4>
                  <p
                    className="text-[#717182] lg:h-[21px]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                    }}
                  >
                    optexopticals@gmail.com
                  </p>
                </div>
              </div>

              {/* Card 4: Hours */}
              <div
                className="flex items-center bg-[#F9FAFB] lg:h-[94.6px] lg:w-[533.6px] lg:gap-[16px] lg:p-[24px]"
                style={{ borderRadius: '16px', border: '0.8px solid #E5E7EB' }}
              >
                <div className="flex items-center justify-center lg:h-[45px] lg:w-[33px]">
                  <ClockIcon />
                </div>
                <div className="flex flex-col lg:h-[45px]">
                  <h4
                    className="text-[#000000] lg:h-[24px]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      lineHeight: '24px',
                    }}
                  >
                    Opening Hours
                  </h4>
                  <p
                    className="text-[#717182] lg:h-[21px]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '21px',
                    }}
                  >
                    Mon - Sat: 9:00 AM - 8:00 PM, Sun: Closed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div
          className="relative overflow-hidden bg-white lg:mt-[40.1px] lg:h-[300px] lg:w-[1240px]"
          style={{
            borderRadius: '32px',
            border: '0.8px solid #F3F4F6',
            boxShadow: 'none',
          }}
        >
          <iframe
            src={buildMapUrl(MAIN_BRANCH)}
            className="h-full w-full border-none"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Map Location"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default function Page() {
  return <Contact />;
}
