'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode } from 'lucide-react';
import QRCode from 'qrcode';

export default function QRDisplay() {
  const [englishQR, setEnglishQR] = useState('');
  const [gujaratiQR, setGujaratiQR] = useState('');

  useEffect(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    QRCode.toDataURL(`${baseUrl}/?lang=english`, {
      width: 400,
      margin: 2,
      color: { dark: '#0A0D14', light: '#F4F5F7' },
      errorCorrectionLevel: 'H',
    }).then(setEnglishQR);

    QRCode.toDataURL(`${baseUrl}/?lang=gujarati`, {
      width: 400,
      margin: 2,
      color: { dark: '#0A0D14', light: '#F4F5F7' },
      errorCorrectionLevel: 'H',
    }).then(setGujaratiQR);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0D14] to-[#0A0D14] islamic-pattern flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-3xl md:text-5xl font-bold text-[#966700] tracking-widest mb-2">
          M.E.S. ENGLISH MEDIUM SCHOOL
        </h1>
        <h2 className="text-xl md:text-3xl text-white/90 tracking-wide">
          ISLAMIC QUIZ COMPETITION
        </h2>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFB000]/10 border border-[#FFB000]/30">
          <QrCode className="w-5 h-5 text-[#966700]" />
          <span className="text-[#966700] text-lg">SCAN TO ENTER</span>
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h3 className="text-2xl md:text-4xl font-bold text-white mb-6">ENGLISH QUIZ</h3>
          <div className="bg-white p-4 rounded-xl gold-glow">
            {englishQR ? (
              <img src={englishQR} alt="English Quiz QR" className="w-64 h-64 md:w-80 md:h-80" />
            ) : (
              <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-[#0A0D14]/30" />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <h3 className="text-2xl md:text-4xl font-bold text-white mb-6">हिंदी क्विज़</h3>
          <div className="bg-white p-4 rounded-xl gold-glow">
            {gujaratiQR ? (
              <img src={gujaratiQR} alt="Gujarati Quiz QR" className="w-64 h-64 md:w-80 md:h-80" />
            ) : (
              <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
                <QrCode className="w-16 h-16 text-[#0A0D14]/30" />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
