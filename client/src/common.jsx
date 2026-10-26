import React, { useEffect, useRef } from 'react';

export const STATUS = {
  PENDING: ['ელოდება', 'gray'],
  SENDING: ['იგზავნება', 'blue'],
  SUBMITTED: ['გაგზავნილია, ველოდებით სტატუსს', 'blue'],
  DELIVERED: ['მიწოდებულია', 'green'],
  FAILED_PERMANENT: ['მუდმივი შეცდომა', 'red'],
  FAILED_FINAL: ['დროებითი შეცდომა, ცდები ამოიწურა', 'orange'],
  NEEDS_REVIEW: ['საჭიროებს შემოწმებას', 'orange'],
  CANCELLED: ['გაუქმებულია', 'gray'],
};

export const KIND = {
  PERMANENT: 'მუდმივი',
  TEMPORARY: 'დროებითი',
  CONFIG: 'პარამეტრების პრობლემა',
  THROTTLED: 'ლიმიტი',
};

export const StatusBadge = ({ status }) => {
  const [label, color] = STATUS[status] ?? [status, 'gray'];
  return <span className={`pill ${color}`}>{label}</span>;
};

export const fmt = (d) => (d ? new Date(d).toLocaleString('ka-GE', { hour12: false }) : '');

export function usePolling(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}
