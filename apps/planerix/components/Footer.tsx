import React from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 px-6 mt-20">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Planerix</span>
            </div>
            <p className="text-sm text-slate-300">Action delivery and outcome tracking for enterprise teams.</p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/product" className="hover:text-white transition-colors">Product</Link></li>
              <li><Link href="/ai-agents" className="hover:text-white transition-colors">AI Agents</Link></li>
              <li><Link href="/memory" className="hover:text-white transition-colors">Memory</Link></li>
              <li><Link href="/outcomes" className="hover:text-white transition-colors">Outcomes</Link></li>
              <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              <li><Link href="/governance" className="hover:text-white transition-colors">Governance</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Solutions</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/solutions" className="hover:text-white transition-colors">Marketing</Link></li>
              <li><Link href="/solutions" className="hover:text-white transition-colors">Sales & RevOps</Link></li>
              <li><Link href="/solutions" className="hover:text-white transition-colors">Finance</Link></li>
              <li><Link href="/solutions" className="hover:text-white transition-colors">Operations</Link></li>
              <li><Link href="/use-cases" className="hover:text-white transition-colors">Use Cases</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/pilot" className="hover:text-white transition-colors">Pilot</Link></li>
              <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="hover:text-white transition-colors">Book a demo</Link></li>
              <li><Link href="/pilot" className="hover:text-white transition-colors">Request a pilot</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm mb-4 md:mb-0">(c) 2026 Planerix. All rights reserved.</p>
          <div className="flex space-x-6 text-sm">
            <span className="text-gray-500">Private AI available</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
