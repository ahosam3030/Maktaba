/** إعدادات طباعة فاتورة المبيعات — تُحفظ محليًا على الجهاز */

export type InvoiceSettings = {
  brandTitle: string;
  brandSubtitle: string;
  phone: string;
  address: string;
  watermarkText: string;
  serviceTags: string[];
  invoiceTitle: string;
  footerText: string;
};

const STORAGE_KEY = 'maktaba_invoice_settings_v1';

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  brandTitle: 'مركز المهندس',
  brandSubtitle: 'للخدمات العلمية والطباعة والأدوات المكتبية',
  phone: '01127897245',
  address: 'شارع بورسعيد أمام الإدارة التعليمية الجديدة — شرق مستشفى العدوة المركزي',
  watermarkText: 'مركز المهندس للخدمات العلمية والطباعة',
  serviceTags: ['خدمات علمية', 'تصوير وطباعة', 'أدوات مكتبية'],
  invoiceTitle: 'فاتورة مبيعات',
  footerText: 'شكرًا لثقتكم بنا',
};

export function loadInvoiceSettings(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INVOICE_SETTINGS, serviceTags: [...DEFAULT_INVOICE_SETTINGS.serviceTags] };
    const parsed = JSON.parse(raw) as Partial<InvoiceSettings>;
    const tags = Array.isArray(parsed.serviceTags)
      ? parsed.serviceTags.map(String).map((t) => t.trim()).filter(Boolean)
      : [...DEFAULT_INVOICE_SETTINGS.serviceTags];
    return {
      brandTitle: String(parsed.brandTitle ?? DEFAULT_INVOICE_SETTINGS.brandTitle).trim() || DEFAULT_INVOICE_SETTINGS.brandTitle,
      brandSubtitle: String(parsed.brandSubtitle ?? DEFAULT_INVOICE_SETTINGS.brandSubtitle).trim() || DEFAULT_INVOICE_SETTINGS.brandSubtitle,
      phone: String(parsed.phone ?? DEFAULT_INVOICE_SETTINGS.phone).trim() || DEFAULT_INVOICE_SETTINGS.phone,
      address: String(parsed.address ?? DEFAULT_INVOICE_SETTINGS.address).trim() || DEFAULT_INVOICE_SETTINGS.address,
      watermarkText: String(parsed.watermarkText ?? DEFAULT_INVOICE_SETTINGS.watermarkText).trim() || DEFAULT_INVOICE_SETTINGS.watermarkText,
      serviceTags: tags.length ? tags : [...DEFAULT_INVOICE_SETTINGS.serviceTags],
      invoiceTitle: String(parsed.invoiceTitle ?? DEFAULT_INVOICE_SETTINGS.invoiceTitle).trim() || DEFAULT_INVOICE_SETTINGS.invoiceTitle,
      footerText: String(parsed.footerText ?? DEFAULT_INVOICE_SETTINGS.footerText).trim() || DEFAULT_INVOICE_SETTINGS.footerText,
    };
  } catch {
    return { ...DEFAULT_INVOICE_SETTINGS, serviceTags: [...DEFAULT_INVOICE_SETTINGS.serviceTags] };
  }
}

export function saveInvoiceSettings(settings: InvoiceSettings): void {
  const clean: InvoiceSettings = {
    brandTitle: settings.brandTitle.trim() || DEFAULT_INVOICE_SETTINGS.brandTitle,
    brandSubtitle: settings.brandSubtitle.trim() || DEFAULT_INVOICE_SETTINGS.brandSubtitle,
    phone: settings.phone.trim() || DEFAULT_INVOICE_SETTINGS.phone,
    address: settings.address.trim() || DEFAULT_INVOICE_SETTINGS.address,
    watermarkText: settings.watermarkText.trim() || DEFAULT_INVOICE_SETTINGS.watermarkText,
    serviceTags: settings.serviceTags.map((t) => t.trim()).filter(Boolean),
    invoiceTitle: settings.invoiceTitle.trim() || DEFAULT_INVOICE_SETTINGS.invoiceTitle,
    footerText: settings.footerText.trim() || DEFAULT_INVOICE_SETTINGS.footerText,
  };
  if (!clean.serviceTags.length) clean.serviceTags = [...DEFAULT_INVOICE_SETTINGS.serviceTags];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

export function resetInvoiceSettings(): InvoiceSettings {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_INVOICE_SETTINGS, serviceTags: [...DEFAULT_INVOICE_SETTINGS.serviceTags] };
}
