import React, { useEffect } from "react";
import "../styles/theme.css";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import CookieBanner from "../components/layout/CookieBanner";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  canonical?: string;
  structuredData?: object;
  bare?: boolean;
}

const ensureMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
  let tag = document.querySelector(selector) as HTMLMetaElement;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.content = content;
};

const ensureLinkTag = (rel: string, href: string) => {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
};

const AppLayout: React.FC<AppLayoutProps> = ({ children, title, description, canonical, structuredData, bare = false }) => {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      ensureMetaTag('meta[name="description"]', 'name', 'description', description);
      ensureMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
      ensureMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }

    if (title) {
      ensureMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
      ensureMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }

    if (canonical) {
      const canonicalUrl = canonical.startsWith('http') ? canonical : `${window.location.origin}${canonical}`;
      ensureLinkTag('canonical', canonicalUrl);
      ensureMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    }

    ensureMetaTag('meta[property="og:type"]', 'property', 'og:type', 'website');
    ensureMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'Tranzor');
    ensureMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');

    if (structuredData) {
      let script = document.querySelector('script[type="application/ld+json"][data-Tranzor="structured-data"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-Tranzor', 'structured-data');
        document.head.appendChild(script);
      }
      script.text = JSON.stringify(structuredData);
    }

    window.scrollTo(0, 0);
  }, [title, description, canonical, structuredData]);

  useEffect(() => {
    const html = document.documentElement;
    const darkMode = localStorage.getItem('darkMode') === 'true';
    html.classList.toggle('theme-dark', darkMode);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {!bare && <Navbar />}
      <main style={{ flex: 1, paddingBottom: '2rem' }}>
        {children}
      </main>
      {!bare && <Footer />}
      <CookieBanner />
    </div>
  );
};

export default AppLayout;