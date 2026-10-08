import React, { useMemo, useState } from 'react';
import { Button, Input, Card, Badge, Alert } from '../components/common';

const HELP_ARTICLES = [
  { id: 1, title: 'How to set up real-time tracking', tags: ['tracking', 'gps'] },
  { id: 2, title: 'Managing multiple tenants', tags: ['tenants', 'multi-tenant'] },
  { id: 3, title: 'Best practices for route optimization', tags: ['routes', 'optimization'] },
];

const HelpCenter: React.FC = () => {
  const [query, setQuery] = useState('');

  const articles = HELP_ARTICLES;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(a => a.title.toLowerCase().includes(q) || a.tags.some(t => t.includes(q)));
  }, [articles, query]);

  const openTicket = () => {
    window.location.href = 'mailto:support@example.com?subject=Support%20Logistics%20Multi-Tenant';
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-white">Help Center</h1>
        <p className="text-gray-400 mt-2">Articles, FAQs and ways to contact support.</p>
      </header>

      <div className="bg-gray-900 p-6 rounded-lg grid gap-6 md:grid-cols-2">
        <div>
          <label className="text-sm text-gray-400">Search articles</label>
          <div className="mt-2 flex">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by keyword or endpoint"
              className="flex-1 p-3 rounded-l bg-gray-800 text-gray-100 focus:outline-none"
            />
            <button
              onClick={() => { /* mantemos para acessibilidade, busca já reativa */ }}
              className="bg-red-600 px-4 rounded-r"
            >Search</button>
          </div>

          <h3 className="text-lg font-semibold text-white mt-6">Articles</h3>
          <ul className="mt-3 space-y-3 text-gray-300">
            {filtered.map(a => (
              <li key={a.id} className="py-2 border-b border-gray-800">{a.title}</li>
            ))}
            {filtered.length === 0 && <li className="text-sm text-gray-500">No articles found.</li>}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">Quick FAQ</h3>
          <dl className="mt-3 space-y-4 text-gray-300">
            <div>
              <dt className="font-medium text-white">How do I get a token?</dt>
              <dd className="text-sm">Use <span className="font-mono">POST /auth/login</span> with your credentials.</dd>
            </div>
            <div>
              <dt className="font-medium text-white">Can I simulate a route?</dt>
              <dd className="text-sm">Yes — go to the transports list and click <em>Simulate</em> to open tracking.</dd>
            </div>
          </dl>

          <div className="mt-6 bg-gray-800 p-4 rounded">
            <h4 className="text-sm text-white font-semibold">Need direct help?</h4>
            <p className="text-gray-400 text-sm mt-2">Open a ticket for technical support or send an email to <span className="font-mono">support@example.com</span>.</p>
            <button onClick={openTicket} className="mt-4 bg-green-600 px-4 py-2 rounded">Open Ticket</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
