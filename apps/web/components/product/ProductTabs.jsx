'use client';

import React, { useState } from 'react';

/**
 * Features / Specifications / Shipping tab switcher. The only reason this is
 * a client component at all is the tab state itself — the content of every
 * panel is static, server-fetched `product` data.
 */
export default function ProductTabs({ product }) {
  const [activeTab, setActiveTab] = useState('Features');

  return (
    <div className="mx-auto mb-[60px] w-full max-w-[1240px]">
      <div
        className="mb-[32px] flex h-[50.8px] gap-[40px] border-b-[0.8px] border-[#D4D4D4]"
        role="tablist"
      >
        {['Features', 'Specifications', 'Shipping'].map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`product-tabpanel-${tab.toLowerCase()}`}
            onClick={() => setActiveTab(tab)}
            className={`flex h-[50px] items-center justify-center pb-[4px] transition-all ${activeTab === tab ? 'border-b-[4px] border-[#2E3192] text-[#2E3192]' : 'text-[#717182] hover:text-black'}`}
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: '20px',
              lineHeight: '30px',
              fontWeight: 700,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Features' && (
        <div
          id="product-tabpanel-features"
          role="tabpanel"
          className="flex min-h-[185px] flex-col gap-[16px] md:flex-row"
        >
          <div className="flex flex-col gap-[16px] py-[8px] md:w-[469.6px]">
            <ul className="flex flex-col gap-[16px]">
              {[
                product.frame_material && `${product.frame_material} construction`,
                product.frame_shape && `${product.frame_shape} frame shape`,
                'Anti-reflective coating',
                'Lightweight design',
              ]
                .filter(Boolean)
                .map((feat, i) => (
                  <li key={i} className="flex items-center">
                    <span className="mr-[12px] h-[8px] w-[8px] flex-shrink-0 rounded-[26843500px] bg-[#E53935]"></span>
                    <span
                      className="text-[#4A4A4A]"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        lineHeight: '24px',
                        fontWeight: 400,
                      }}
                    >
                      {feat}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="ml-[40px] md:w-[469.6px]">
            <div className="flex h-full w-full flex-col gap-[16px] rounded-[32px] bg-[#F9F9F9] p-[32px]">
              <h4
                className="text-[#0A0A0A]"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '18px',
                  lineHeight: '27px',
                  fontWeight: 700,
                }}
              >
                Premium Packaging Included
              </h4>
              <p
                className="text-[#717182]"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '16px',
                  lineHeight: '26px',
                  fontWeight: 400,
                }}
              >
                Every pair of glasses comes with our signature hard case, a microfiber cleaning
                cloth, and a certificate of authenticity.
              </p>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'Specifications' && (
        <div
          id="product-tabpanel-specifications"
          role="tabpanel"
          className="text-[#4A4A4A]"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '16px',
            lineHeight: '24px',
            fontWeight: 400,
          }}
        >
          <dl className="grid max-w-md grid-cols-2 gap-4">
            {[
              ['SKU', product.sku],
              ['Brand', product.brand],
              ['Material', product.frame_material],
              ['Shape', product.frame_shape],
              ['Gender', product.gender],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="font-bold text-gray-900">{k}</dt>
                  <dd className="capitalize">{v}</dd>
                </React.Fragment>
              ))}
          </dl>
        </div>
      )}
      {activeTab === 'Shipping' && (
        <div
          id="product-tabpanel-shipping"
          role="tabpanel"
          className="text-[#4A4A4A]"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '16px',
            lineHeight: '24px',
            fontWeight: 400,
          }}
        >
          <p>
            Delivery within Nairobi: 1-2 business days. Other counties: 3-5 business days. Free
            shipping on orders above KES 10,000.
          </p>
        </div>
      )}
    </div>
  );
}
