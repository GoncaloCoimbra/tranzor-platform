import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/* ─────────────────────────────────────────
   TIPOS
   ───────────────────────────────────────── */
export interface FilterState {
  price: [number, number];
  [key: string]: string[] | [number, number] | string | boolean;
}

interface ProductFiltersProps {
  category?: string;
  subcategory?: string;
  onChange?: (filters: FilterState) => void;
  compact?: boolean;
}

interface FilterOption { value: string; label: string; color?: string }
interface FilterGroup {
  id: string;
  label: string;
  type: 'checkbox' | 'color' | 'range' | 'toggle' | 'size';
  options?: FilterOption[];
  min?: number; max?: number; unit?: string;
  defaultOpen?: boolean;
}

/* ─────────────────────────────────────────
   MARCAS COMUNS POR DOMÍNIO
   ───────────────────────────────────────── */
const MARCA_ESCRITA: FilterOption[] = [
  { value: 'pilot',        label: 'Pilot' },
  { value: 'bic',          label: 'BIC' },
  { value: 'stabilo',      label: 'Stabilo' },
  { value: 'parker',       label: 'Parker' },
  { value: 'pentel',       label: 'Pentel' },
  { value: 'uni',          label: 'Uni-ball' },
  { value: 'schneider',    label: 'Schneider' },
];

const MARCA_CALCULADORAS: FilterOption[] = [
  { value: 'casio',        label: 'Casio' },
  { value: 'texas',        label: 'Texas Instruments' },
  { value: 'hp',           label: 'HP' },
  { value: 'sharp',        label: 'Sharp' },
  { value: 'canon',        label: 'Canon' },
];

const MARCA_LAPIS: FilterOption[] = [
  { value: 'faber',        label: 'Faber-Castell' },
  { value: 'staedtler',    label: 'Staedtler' },
  { value: 'stabilo',      label: 'Stabilo' },
  { value: 'caran',        label: "Caran d'Ache" },
  { value: 'maped',        label: 'Maped' },
  { value: 'milan',        label: 'Milan' },
];

const MARCA_IMPRESSORAS: FilterOption[] = [
  { value: 'hp',           label: 'HP' },
  { value: 'epson',        label: 'Epson' },
  { value: 'canon',        label: 'Canon' },
  { value: 'brother',      label: 'Brother' },
  { value: 'xerox',        label: 'Xerox' },
  { value: 'lexmark',      label: 'Lexmark' },
];

const MARCA_CADERNOS: FilterOption[] = [
  { value: 'oxford',       label: 'Oxford' },
  { value: 'leitz',        label: 'Leitz' },
  { value: 'clairef',      label: 'Clairefontaine' },
  { value: 'avery',        label: 'Avery' },
  { value: 'pigna',        label: 'Pigna' },
  { value: 'maped',        label: 'Maped' },
];

const MARCA_MOBILIARIO: FilterOption[] = [
  { value: 'leitz',        label: 'Leitz' },
  { value: 'esselte',      label: 'Esselte' },
  { value: 'fellowes',     label: 'Fellowes' },
  { value: 'niceday',      label: 'Niceday' },
  { value: 'steelcase',    label: 'Steelcase' },
  { value: 'ikea',         label: 'IKEA' },
];

/* ─────────────────────────────────────────
   FILTROS POR CATEGORIA / SUBCATEGORIA
   ─────────────────────────────────────────
   ALTERAÇÕES vs. versão anterior:
   • Adicionado grupo "marca" em: calculadoras, canetas,
     lapis, impressoras, cadernos, mobiliario
   • Ordem dos grupos respeita o pedido do utilizador:
     Calculadoras → Tipo · Marca · Alimentação · Ecrã · Nível · Preço
     Canetas      → Tipo · Marca · Cor · Espessura · Preço
     Lápis        → Tipo · Marca · Nº Unidades · Preço
     Impressoras  → Tecnologia · Marca · Impressão a Cor · Ligação · Preço
     Cadernos     → Formato · Pauta · Marca · Nº Folhas · Cor Capa · Preço
     Mobiliário   → Tipo · Material · Cor · Ergonomia · Marca · Preço
   ───────────────────────────────────────── */
const FILTERS_BY_CATEGORY: Record<string, FilterGroup[]> = {

  /* ── Calculadoras ── */
  'calculadoras': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'cientifica',    label: 'Científica' },
      { value: 'basica',        label: 'Básica' },
      { value: 'grafica',       label: 'Gráfica' },
      { value: 'financeira',    label: 'Financeira' },
      { value: 'impressora',    label: 'Com Impressora' },
    ]},
    // ← NOVO: Marca
    { id: 'marca', label: 'Marca', type: 'checkbox', defaultOpen: true, options: MARCA_CALCULADORAS },
    { id: 'alimentacao', label: 'Alimentação', type: 'checkbox', options: [
      { value: 'solar',         label: 'Solar' },
      { value: 'pilhas',        label: 'Pilhas' },
      { value: 'dupla',         label: 'Solar + Pilhas' },
      { value: 'usb',           label: 'USB-C' },
    ]},
    { id: 'ecra', label: 'Tipo de Ecrã', type: 'checkbox', options: [
      { value: 'lcd',           label: 'LCD' },
      { value: 'natural',       label: 'Natural Display' },
      { value: 'cor',           label: 'Cor' },
      { value: 'tactil',        label: 'Tátil' },
    ]},
    { id: 'nivel', label: 'Nível de Ensino', type: 'checkbox', defaultOpen: true, options: [
      { value: 'basico',        label: 'Ensino Básico' },
      { value: 'secundario',    label: 'Secundário / Exames' },
      { value: 'universitario', label: 'Universitário' },
      { value: 'profissional',  label: 'Profissional' },
    ]},
    { id: 'funcoes', label: 'Funções', type: 'checkbox', options: [
      { value: 'fracoes',       label: 'Frações' },
      { value: 'estatistica',   label: 'Estatística' },
      { value: 'matrizes',      label: 'Matrizes' },
      { value: 'programavel',   label: 'Programável' },
      { value: 'cas',           label: 'CAS (álgebra simbólica)' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 3, max: 200, unit: '€', defaultOpen: true },
  ],

  /* ── Canetas ── */
  'canetas': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'esferografica', label: 'Esferográfica' },
      { value: 'gel',           label: 'Gel' },
      { value: 'fineliner',     label: 'Fineliner' },
      { value: 'rollerball',    label: 'Rollerball' },
      { value: 'fonte',         label: 'Caneta-tinteiro' },
      { value: 'marcador',      label: 'Marcador' },
      { value: 'pincel',        label: 'Pincel / Brush pen' },
    ]},
    // ← NOVO: Marca
    { id: 'marca', label: 'Marca', type: 'checkbox', defaultOpen: true, options: MARCA_ESCRITA },
    { id: 'cor', label: 'Cor de Tinta', type: 'color', defaultOpen: true, options: [
      { value: 'azul',          label: 'Azul',      color: '#1565C0' },
      { value: 'preto',         label: 'Preto',     color: '#111111' },
      { value: 'vermelho',      label: 'Vermelho',  color: '#D90429' },
      { value: 'verde',         label: 'Verde',     color: '#2E7D32' },
      { value: 'laranja',       label: 'Laranja',   color: '#E65100' },
      { value: 'roxo',          label: 'Roxo',      color: '#6A1B9A' },
      { value: 'rosa',          label: 'Rosa',      color: '#C2185B' },
      { value: 'castanho',      label: 'Castanho',  color: '#5D4037' },
    ]},
    { id: 'espessura', label: 'Espessura de Ponta', type: 'checkbox', options: [
      { value: '0.3',           label: 'Extrafina (0,3 mm)' },
      { value: '0.5',           label: 'Fina (0,5 mm)' },
      { value: '0.7',           label: 'Média (0,7 mm)' },
      { value: '1.0',           label: 'Grossa (1,0 mm)' },
      { value: '1.5p',          label: 'Muito Grossa (>1,5 mm)' },
    ]},
    { id: 'acabamento', label: 'Características', type: 'checkbox', options: [
      { value: 'apagavel',      label: 'Apagável' },
      { value: 'recarga',       label: 'Com Recarga' },
      { value: 'tampao',        label: 'Com Tampão' },
      { value: 'clip',          label: 'Com Clip' },
      { value: 'grip',          label: 'Grip antiderrapante' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 0.5, max: 120, unit: '€', defaultOpen: true },
  ],

  /* ── Marcadores / Fluorescentes ── */
  'marcadores': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'fluorescente',  label: 'Fluorescente' },
      { value: 'permanente',    label: 'Permanente' },
      { value: 'quadro',        label: 'Quadro Branco' },
      { value: 'tecnico',       label: 'Técnico' },
      { value: 'brushpen',      label: 'Brush Pen' },
    ]},
    { id: 'marca', label: 'Marca', type: 'checkbox', defaultOpen: true, options: MARCA_ESCRITA },
    { id: 'cor', label: 'Cor', type: 'color', defaultOpen: true, options: [
      { value: 'amarelo',       label: 'Amarelo',   color: '#FFEB3B' },
      { value: 'rosa',          label: 'Rosa',      color: '#F06292' },
      { value: 'verde',         label: 'Verde',     color: '#66BB6A' },
      { value: 'azul',          label: 'Azul',      color: '#42A5F5' },
      { value: 'laranja',       label: 'Laranja',   color: '#FFA726' },
      { value: 'roxo',          label: 'Roxo',      color: '#AB47BC' },
      { value: 'preto',         label: 'Preto',     color: '#111111' },
    ]},
    { id: 'ponta', label: 'Tipo de Ponta', type: 'checkbox', options: [
      { value: 'bisel',         label: 'Bisel' },
      { value: 'redonda',       label: 'Redonda' },
      { value: 'dupla',         label: 'Dupla (fina/larga)' },
      { value: 'pincel',        label: 'Pincel' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 0.5, max: 60, unit: '€', defaultOpen: true },
  ],

  /* ── Lápis (inclui Artes / lápis de cor / grafite) ──
     ALTERAÇÕES: Marca adicionada; unidades já existia   */
  'lapis': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'cor',           label: 'Lápis de Cor' },
      { value: 'grafite',       label: 'Grafite' },
      { value: 'carvao',        label: 'Carvão' },
      { value: 'aguarela',      label: 'Aguarelável' },
      { value: 'pastel',        label: 'Pastel Seco' },
      { value: 'pastel-oleo',   label: 'Pastel de Óleo' },
      { value: 'mecanico',      label: 'Lapiseira Mecânica' },
    ]},
    // ← NOVO: Marca
    { id: 'marca', label: 'Marca', type: 'checkbox', defaultOpen: true, options: MARCA_LAPIS },
    { id: 'unidades', label: 'Nº de Peças', type: 'checkbox', defaultOpen: true, options: [
      { value: 'unit',          label: 'Individual' },
      { value: '12',            label: '12 un.' },
      { value: '24',            label: '24 un.' },
      { value: '36',            label: '36 un.' },
      { value: '48',            label: '48 un.' },
      { value: '72p',           label: '72+ un.' },
    ]},
    { id: 'dureza', label: 'Dureza (Grafite)', type: 'checkbox', options: [
      { value: '9h-4h',         label: '9H – 4H (Muito Duro)' },
      { value: '3h-h',          label: '3H – H (Duro)' },
      { value: 'hb',            label: 'HB (Médio)' },
      { value: 'b-3b',          label: 'B – 3B (Suave)' },
      { value: '4b-9b',         label: '4B – 9B (Muito Suave)' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 1, max: 150, unit: '€', defaultOpen: true },
  ],

  /* ── Cadernos ──
     ALTERAÇÕES: Marca adicionada (posição 3ª, após pauta) */
  'cadernos': [
    { id: 'formato', label: 'Formato', type: 'checkbox', defaultOpen: true, options: [
      { value: 'a3',            label: 'A3' },
      { value: 'a4',            label: 'A4' },
      { value: 'a5',            label: 'A5' },
      { value: 'a6',            label: 'A6' },
      { value: 'bullet',        label: 'Bullet / Carta' },
      { value: 'b5',            label: 'B5' },
    ]},
    { id: 'pauta', label: 'Tipo de Pauta', type: 'checkbox', defaultOpen: true, options: [
      { value: 'pautado',       label: 'Pautado' },
      { value: 'quadricula',    label: 'Quadriculado' },
      { value: 'liso',          label: 'Liso' },
      { value: 'pontilhado',    label: 'Pontilhado (Dot Grid)' },
      { value: 'music',         label: 'Pautas Musicais' },
    ]},
    // ← NOVO: Marca
    { id: 'marca', label: 'Marca', type: 'checkbox', defaultOpen: true, options: MARCA_CADERNOS },
    { id: 'folhas', label: 'Nº de Folhas', type: 'checkbox', options: [
      { value: '48',            label: 'Até 50 folhas' },
      { value: '100',           label: '50 – 100 folhas' },
      { value: '200',           label: '100 – 200 folhas' },
      { value: '200p',          label: '200+ folhas' },
    ]},
    { id: 'cor_capa', label: 'Cor da Capa', type: 'color', options: [
      { value: 'preto',         label: 'Preto',     color: '#111111' },
      { value: 'azul',          label: 'Azul',      color: '#1565C0' },
      { value: 'vermelho',      label: 'Vermelho',  color: '#D90429' },
      { value: 'verde',         label: 'Verde',     color: '#2E7D32' },
      { value: 'amarelo',       label: 'Amarelo',   color: '#F9A825' },
      { value: 'cinza',         label: 'Cinza',     color: '#757575' },
      { value: 'rosa',          label: 'Rosa',      color: '#E91E63' },
      { value: 'laranja',       label: 'Laranja',   color: '#FF6F00' },
    ]},
    { id: 'encadernacao', label: 'Encadernação', type: 'checkbox', options: [
      { value: 'espiral',       label: 'Espiral' },
      { value: 'cosido',        label: 'Cosido/Colar' },
      { value: 'agrafado',      label: 'Agrafado' },
      { value: 'rigida',        label: 'Capa Rígida' },
      { value: 'flexivel',      label: 'Capa Flexível' },
    ]},
    { id: 'gramagem', label: 'Gramagem do Papel', type: 'checkbox', options: [
      { value: '60-70',         label: '60–70 g/m²' },
      { value: '80',            label: '80 g/m²' },
      { value: '90-100',        label: '90–100 g/m²' },
      { value: '120p',          label: '120+ g/m²' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 1, max: 50, unit: '€', defaultOpen: true },
  ],

  /* ── Telas ── */
  'telas': [
    { id: 'material', label: 'Material', type: 'checkbox', defaultOpen: true, options: [
      { value: 'algodao',       label: 'Algodão 100%' },
      { value: 'linho',         label: 'Linho' },
      { value: 'algodao-linho', label: 'Algodão/Linho' },
      { value: 'sintetico',     label: 'Sintético (poliéster)' },
    ]},
    { id: 'medidas', label: 'Medidas (cm)', type: 'size', defaultOpen: true, options: [
      { value: '18x24',         label: '18 × 24' },
      { value: '24x30',         label: '24 × 30' },
      { value: '30x30',         label: '30 × 30 (quadrada)' },
      { value: '30x40',         label: '30 × 40' },
      { value: '40x50',         label: '40 × 50' },
      { value: '50x60',         label: '50 × 60' },
      { value: '50x70',         label: '50 × 70' },
      { value: '60x80',         label: '60 × 80' },
      { value: '70x100',        label: '70 × 100' },
      { value: '80x100',        label: '80 × 100' },
      { value: '100x120p',      label: '100 × 120+' },
    ]},
    { id: 'formato', label: 'Formato', type: 'checkbox', options: [
      { value: 'retrato',       label: 'Retrato (vertical)' },
      { value: 'paisagem',      label: 'Paisagem (horizontal)' },
      { value: 'quadrado',      label: 'Quadrado' },
      { value: 'panoramico',    label: 'Panorâmico' },
    ]},
    { id: 'profundidade', label: 'Profundidade do Chassi', type: 'checkbox', options: [
      { value: '18mm',          label: '18 mm (Standard)' },
      { value: '38mm',          label: '38 mm (Galeria)' },
      { value: '60mm',          label: '60 mm (Extra-Profundo)' },
    ]},
    { id: 'preparacao', label: 'Preparação', type: 'checkbox', options: [
      { value: 'imprimada',     label: 'Imprimada (pronta a usar)' },
      { value: 'nua',           label: 'Sem Apprêt' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 2, max: 120, unit: '€', defaultOpen: true },
  ],

  /* ── Pintura ── */
  'pintura': [
    { id: 'tecnica', label: 'Técnica', type: 'checkbox', defaultOpen: true, options: [
      { value: 'acrilica',      label: 'Acrílica' },
      { value: 'aguarela',      label: 'Aguarela' },
      { value: 'oleo',          label: 'Óleo' },
      { value: 'guache',        label: 'Guache / Tempera' },
      { value: 'spray',         label: 'Spray' },
      { value: 'gouache',       label: 'Gouache' },
    ]},
    { id: 'qualidade', label: 'Qualidade', type: 'checkbox', options: [
      { value: 'estudante',     label: 'Estudante' },
      { value: 'artista',       label: 'Artista / Profissional' },
      { value: 'escolar',       label: 'Escolar' },
    ]},
    { id: 'volume', label: 'Volume / Embalagem', type: 'checkbox', options: [
      { value: '20ml',          label: 'Até 20 ml' },
      { value: '40ml',          label: '20 – 75 ml' },
      { value: '150ml',         label: '75 – 250 ml' },
      { value: '500ml',         label: '250 ml – 1 L' },
      { value: '1lp',           label: '1 L+' },
    ]},
    { id: 'acabamento', label: 'Acabamento', type: 'checkbox', options: [
      { value: 'brilhante',     label: 'Brilhante' },
      { value: 'mate',          label: 'Mate' },
      { value: 'setim',         label: 'Setim / Acetinado' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 1, max: 100, unit: '€', defaultOpen: true },
  ],

  /* ── Pincéis ── */
  'pinceis': [
    { id: 'tipo', label: 'Tipo de Pincel', type: 'checkbox', defaultOpen: true, options: [
      { value: 'redondo',       label: 'Redondo' },
      { value: 'chato',         label: 'Chato' },
      { value: 'leque',         label: 'Leque' },
      { value: 'angular',       label: 'Angular' },
      { value: 'lingua-gato',   label: 'Língua de Gato' },
      { value: 'filbert',       label: 'Filbert' },
      { value: 'esponja',       label: 'Esponja / Paletina' },
    ]},
    { id: 'pelo', label: 'Material do Pelo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'sintetico',     label: 'Sintético' },
      { value: 'marta',         label: 'Pelo de Marta' },
      { value: 'javali',        label: 'Pelo de Javali / Cerda' },
      { value: 'misto',         label: 'Misto' },
    ]},
    { id: 'tecnica', label: 'Técnica', type: 'checkbox', options: [
      { value: 'acrilica',      label: 'Acrílica' },
      { value: 'oleo',          label: 'Óleo' },
      { value: 'aguarela',      label: 'Aguarela' },
      { value: 'universal',     label: 'Universal' },
    ]},
    { id: 'numero', label: 'Nº do Pincel', type: 'checkbox', options: [
      { value: '0-2',           label: 'Nº 0 – 2 (Fino)' },
      { value: '3-6',           label: 'Nº 3 – 6 (Médio)' },
      { value: '7-12',          label: 'Nº 7 – 12 (Grande)' },
      { value: '12p',           label: 'Nº 12+ (Extra Grande)' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 1, max: 80, unit: '€', defaultOpen: true },
  ],

  /* ── Impressoras ──
     ALTERAÇÕES: Marca adicionada; "Impressão a Cor" separado como filtro próprio */
  'impressoras': [
    { id: 'tecnologia', label: 'Tecnologia', type: 'checkbox', defaultOpen: true, options: [
      { value: 'jacto',         label: 'Jacto de Tinta' },
      { value: 'laser',         label: 'Laser' },
      { value: 'multifuncoes',  label: 'Multifunções' },
      { value: 'tanque',        label: 'Tanque de Tinta EcoTank' },
      { value: 'etiquetas',     label: 'Etiquetas / Térmicas' },
    ]},
    // ← NOVO: Marca
    { id: 'marca', label: 'Marca', type: 'checkbox', defaultOpen: true, options: MARCA_IMPRESSORAS },
    // ← ALTERADO: "Impressão a Cor" é agora um grupo autónomo
    { id: 'impressao_cor', label: 'Impressão a Cor', type: 'checkbox', defaultOpen: true, options: [
      { value: 'monocromatica', label: 'Monocromática' },
      { value: 'cor',           label: 'A Cores' },
      { value: 'frente-verso',  label: 'Frente e Verso (duplex)' },
      { value: 'foto',          label: 'Qualidade Fotográfica' },
    ]},
    { id: 'ligacao', label: 'Ligação', type: 'checkbox', options: [
      { value: 'wifi',          label: 'Wi-Fi' },
      { value: 'usb',           label: 'USB' },
      { value: 'ethernet',      label: 'Ethernet' },
      { value: 'bluetooth',     label: 'Bluetooth' },
      { value: 'nfc',           label: 'NFC' },
    ]},
    { id: 'velocidade', label: 'Velocidade (ppm)', type: 'checkbox', options: [
      { value: '0-15',          label: 'Até 15 ppm' },
      { value: '16-30',         label: '16 – 30 ppm' },
      { value: '31-50',         label: '31 – 50 ppm' },
      { value: '50p',           label: '50+ ppm' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 40, max: 1500, unit: '€', defaultOpen: true },
  ],

  /* ── Papel e Impressão ── */
  'papel': [
    { id: 'tipo', label: 'Tipo de Papel', type: 'checkbox', defaultOpen: true, options: [
      { value: 'a4-standard',   label: 'A4 Standard' },
      { value: 'fotografico',   label: 'Fotográfico' },
      { value: 'reciclado',     label: 'Reciclado' },
      { value: 'cor',           label: 'Papel de Cor' },
      { value: 'envelope',      label: 'Envelopes' },
      { value: 'autocolante',   label: 'Autocolante / Etiquetas' },
      { value: 'transfer',      label: 'Transfer Térmico' },
    ]},
    { id: 'formato', label: 'Formato', type: 'checkbox', options: [
      { value: 'a3',            label: 'A3' },
      { value: 'a4',            label: 'A4' },
      { value: 'a5',            label: 'A5' },
      { value: 'a6',            label: 'A6' },
      { value: 'legal',         label: 'Legal / Ofício' },
    ]},
    { id: 'gramagem', label: 'Gramagem', type: 'checkbox', options: [
      { value: '60-75',         label: '60–75 g/m²' },
      { value: '80',            label: '80 g/m² (Standard)' },
      { value: '90-100',        label: '90–100 g/m²' },
      { value: '120-160',       label: '120–160 g/m²' },
      { value: '200p',          label: '200+ g/m² (Cartão)' },
    ]},
    { id: 'unidades', label: 'Quantidade', type: 'checkbox', options: [
      { value: '50',            label: '50 folhas' },
      { value: '100',           label: '100 folhas' },
      { value: '250',           label: '250 folhas' },
      { value: '500',           label: '500 folhas (Resma)' },
      { value: '2500p',         label: '2500+ folhas' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 2, max: 80, unit: '€', defaultOpen: true },
  ],

  /* ── Mobiliário ──
     ALTERAÇÕES: Marca adicionada (no fim, antes do preço) */
  'mobiliario': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'cadeira',       label: 'Cadeira de Escritório' },
      { value: 'secretaria',    label: 'Secretária' },
      { value: 'armario',       label: 'Armário' },
      { value: 'mesa-reuniao',  label: 'Mesa de Reunião' },
      { value: 'gaveteiro',     label: 'Gaveteiro' },
      { value: 'estante',       label: 'Estante' },
    ]},
    { id: 'material', label: 'Material', type: 'checkbox', options: [
      { value: 'metal',         label: 'Metal / Aço' },
      { value: 'madeira',       label: 'Madeira Maciça' },
      { value: 'mdf',           label: 'MDF / Melamina' },
      { value: 'plastico',      label: 'Plástico' },
      { value: 'tecido',        label: 'Tecido / Malha' },
      { value: 'pele',          label: 'Pele / Eco-pele' },
    ]},
    { id: 'cor', label: 'Cor', type: 'color', options: [
      { value: 'preto',         label: 'Preto',     color: '#111111' },
      { value: 'branco',        label: 'Branco',    color: '#EEEEEE' },
      { value: 'cinza',         label: 'Cinza',     color: '#757575' },
      { value: 'nogueira',      label: 'Nogueira',  color: '#795548' },
      { value: 'carvalho',      label: 'Carvalho',  color: '#A1887F' },
      { value: 'azul',          label: 'Azul',      color: '#1565C0' },
      { value: 'verde',         label: 'Verde',     color: '#2E7D32' },
    ]},
    { id: 'ergonomia', label: 'Ergonomia', type: 'checkbox', options: [
      { value: 'elevatorio',    label: 'Regulável em Altura' },
      { value: 'lombar',        label: 'Apoio Lombar' },
      { value: 'bracos',        label: 'Apoio de Braços' },
      { value: 'reposacabecas', label: 'Repousa-Cabeças' },
      { value: 'certificado',   label: 'Certificado Ergonómico' },
    ]},
    // ← NOVO: Marca
    { id: 'marca', label: 'Marca', type: 'checkbox', options: MARCA_MOBILIARIO },
    { id: 'price', label: 'Preço', type: 'range', min: 30, max: 3000, unit: '€', defaultOpen: true },
  ],

  /* ── EPI ── */
  'epi': [
    { id: 'tipo', label: 'Tipo de Proteção', type: 'checkbox', defaultOpen: true, options: [
      { value: 'luvas',         label: 'Luvas' },
      { value: 'mascara',       label: 'Máscara / Respirador' },
      { value: 'oculos',        label: 'Óculos de Proteção' },
      { value: 'capacete',      label: 'Capacete' },
      { value: 'vestuario',     label: 'Vestuário de Proteção' },
      { value: 'calcado',       label: 'Calçado de Segurança' },
      { value: 'auricular',     label: 'Proteção Auricular' },
    ]},
    { id: 'tamanho', label: 'Tamanho', type: 'checkbox', options: [
      { value: 'xs-s',          label: 'XS / S' },
      { value: 'm',             label: 'M' },
      { value: 'l',             label: 'L' },
      { value: 'xl-xxl',        label: 'XL / XXL' },
      { value: 'unico',         label: 'Tamanho Único' },
    ]},
    { id: 'certificacao', label: 'Certificação', type: 'checkbox', options: [
      { value: 'ce',            label: 'Marcação CE' },
      { value: 'en388',         label: 'EN 388 (Mecânico)' },
      { value: 'en374',         label: 'EN 374 (Químico)' },
      { value: 'ffp2',          label: 'FFP2' },
      { value: 'ffp3',          label: 'FFP3' },
      { value: 'ansi',          label: 'ANSI / ISEA' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 1, max: 300, unit: '€', defaultOpen: true },
  ],

  /* ── Jogos de Mesa ── */
  'jogos': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'classico',      label: 'Clássico' },
      { value: 'cooperativo',   label: 'Cooperativo' },
      { value: 'estrategia',    label: 'Estratégia' },
      { value: 'familia',       label: 'Família' },
      { value: 'cartas',        label: 'Cartas' },
      { value: 'dados',         label: 'Dados' },
      { value: 'word',          label: 'Palavras / Quiz' },
    ]},
    { id: 'jogadores', label: 'Nº de Jogadores', type: 'checkbox', defaultOpen: true, options: [
      { value: '1',             label: 'Solo (1)' },
      { value: '2',             label: '2 jogadores' },
      { value: '2-4',           label: '2 – 4 jogadores' },
      { value: '4-6',           label: '4 – 6 jogadores' },
      { value: '6p',            label: '6+ jogadores' },
    ]},
    { id: 'idade', label: 'Idade Mínima', type: 'checkbox', options: [
      { value: '3',             label: '3+ anos' },
      { value: '6',             label: '6+ anos' },
      { value: '8',             label: '8+ anos' },
      { value: '12',            label: '12+ anos' },
      { value: '14',            label: '14+ anos' },
      { value: '18',            label: '18+ anos' },
    ]},
    { id: 'duracao', label: 'Duração', type: 'checkbox', options: [
      { value: '15m',           label: 'Até 15 min' },
      { value: '30m',           label: '15 – 30 min' },
      { value: '60m',           label: '30 – 60 min' },
      { value: '2h',            label: '1 – 2 horas' },
      { value: '2hp',           label: '2+ horas' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 5, max: 150, unit: '€', defaultOpen: true },
  ],

  /* ── Puzzles ── */
  'puzzles': [
    { id: 'pecas', label: 'Nº de Peças', type: 'checkbox', defaultOpen: true, options: [
      { value: '48-100',        label: 'Até 100 peças' },
      { value: '250',           label: '250 peças' },
      { value: '500',           label: '500 peças' },
      { value: '1000',          label: '1000 peças' },
      { value: '1500',          label: '1500 peças' },
      { value: '2000p',         label: '2000+ peças' },
    ]},
    { id: 'tema', label: 'Tema', type: 'checkbox', defaultOpen: true, options: [
      { value: 'paisagem',      label: 'Paisagem / Natureza' },
      { value: 'cidades',       label: 'Cidades / Mapas' },
      { value: 'animais',       label: 'Animais' },
      { value: 'arte',          label: 'Arte / Quadros' },
      { value: 'fantasia',      label: 'Fantasia' },
      { value: 'infantil',      label: 'Infantil' },
    ]},
    { id: 'tipo', label: 'Tipo', type: 'checkbox', options: [
      { value: 'classico',      label: 'Clássico (2D)' },
      { value: '3d',            label: '3D' },
      { value: 'madeira',       label: 'Madeira' },
      { value: 'dupla-face',    label: 'Dupla Face' },
    ]},
    { id: 'idade', label: 'Idade', type: 'checkbox', options: [
      { value: 'crianca',       label: 'Criança (3–8 anos)' },
      { value: 'junior',        label: 'Júnior (8–14 anos)' },
      { value: 'adulto',        label: 'Adulto (14+ anos)' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 5, max: 120, unit: '€', defaultOpen: true },
  ],

  /* ── Armazenamento de Dados ── */
  'armazenamento': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'pen',           label: 'Pen USB' },
      { value: 'disco-externo', label: 'Disco Externo HDD' },
      { value: 'ssd-externo',   label: 'SSD Externo' },
      { value: 'sd',            label: 'Cartão SD / microSD' },
    ]},
    { id: 'capacidade', label: 'Capacidade', type: 'checkbox', defaultOpen: true, options: [
      { value: '16-64',         label: '16 – 64 GB' },
      { value: '128',           label: '128 GB' },
      { value: '256',           label: '256 GB' },
      { value: '512',           label: '512 GB' },
      { value: '1tb',           label: '1 TB' },
      { value: '2tbp',          label: '2 TB+' },
    ]},
    { id: 'interface', label: 'Interface', type: 'checkbox', options: [
      { value: 'usb-a',         label: 'USB-A 3.0' },
      { value: 'usb-c',         label: 'USB-C' },
      { value: 'dual',          label: 'USB-A + USB-C' },
      { value: 'thunderbolt',   label: 'Thunderbolt' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 5, max: 300, unit: '€', defaultOpen: true },
  ],

  /* ── Higiene e Limpeza ── */
  'higiene': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'tissue', label: 'Tissue / Guardanapos' },
      { value: 'desinfetante', label: 'Desinfetante' },
      { value: 'higiene-pessoal', label: 'Higiene Pessoal' },
      { value: 'sacos', label: 'Sacos e Contentores' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 1, max: 120, unit: '€', defaultOpen: true },
  ],

  /* ── Indústria ── */
  'industria': [
    { id: 'tipo', label: 'Tipo', type: 'checkbox', defaultOpen: true, options: [
      { value: 'epi', label: 'EPI / Proteção Individual' },
      { value: 'embalagem', label: 'Embalagem' },
      { value: 'fita', label: 'Fitas Adesivas' },
      { value: 'sinalizacao', label: 'Sinalização' },
    ]},
    { id: 'price', label: 'Preço', type: 'range', min: 2, max: 250, unit: '€', defaultOpen: true },
  ],
};

/* ── Fallback genérico ── */
const GENERIC_FILTERS: FilterGroup[] = [
  { id: 'price', label: 'Preço', type: 'range', min: 0, max: 500, unit: '€', defaultOpen: true },
];

/* ─────────────────────────────────────────
   RESOLUÇÃO DE FILTROS POR CATEGORIA/SUB
   ─────────────────────────────────────────
   ALTERAÇÕES: mapeamentos expandidos para cobrir
   todos os slugs usados no ShopPage / SubcategoryPage
   ───────────────────────────────────────── */
function resolveFilters(category?: string, subcategory?: string): FilterGroup[] {
  const normalize = (s?: string) =>
    s?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-') ?? '';

  const subKey = normalize(subcategory);
  const catKey = normalize(category);

  // Correspondência directa (subcategoria == chave do mapa)
  if (FILTERS_BY_CATEGORY[subKey]) return FILTERS_BY_CATEGORY[subKey];

  // Tabela de mapeamentos explícitos sub-slug → chave de filtros
  const subMapping: Record<string, string> = {
    // Escolar
    'calculadoras':              'calculadoras',
    'cientificas':               'calculadoras',
    'basicas':                   'calculadoras',
    'graficas':                  'calculadoras',
    'cadernos-e-blocos':         'cadernos',
    'cadernos-a4':               'cadernos',
    'cadernos-a5':               'cadernos',
    'blocos-de-notas':           'cadernos',
    'post-it-e-notas-adesivas':  'cadernos',
    'diarios':                   'cadernos',
    'diarios-e-cadernos':        'cadernos',
    'bullet-journals':           'cadernos',
    'agendas':                   'cadernos',
    'desenhar-e-colorir':        'lapis',
    'lapis-de-cor':              'lapis',
    'marcadores':                'marcadores',
    'pasteis':                   'lapis',
    'escrita-e-correcao':        'canetas',
    'canetas':                   'canetas',
    'lapsis':                    'lapis',
    'lapispis':                  'lapis',
    // Escritório
    'escrita':                   'canetas',
    'papel-e-impressao':         'papel',
    // Informática
    'impressao':                 'impressoras',
    'impressoras-jacto-de-tinta':'impressoras',
    'impressoras-laser':         'impressoras',
    'impressoras-multifuncoes':  'impressoras',
    'armazenamento-de-dados':    'armazenamento',
    'pens-usb':                  'armazenamento',
    'discos-externos':           'armazenamento',
    // Artes
    'pintura':                   'pintura',
    'acrilica':                  'pintura',
    'aguarela':                  'pintura',
    'oleo':                      'pintura',
    'telas':                     'telas',
    'telas-de-algodao':          'telas',
    'telas-de-linho':            'telas',
    'pinceis-e-acessorios':      'pinceis',
    'pinceis-sinteticos':        'pinceis',
    'lapis-de-grafite':          'lapis',
    'desenho-e-ilustracao':      'lapis',
    'canetas-de-ponta-fina':     'canetas',
    'canetas-de-esferografica':  'canetas',
    'canetas-de-gel':            'canetas',
    'canetas-de-luxo':           'canetas',
    'conjuntos-de-escrita':      'canetas',
    'plotters':                  'impressoras',
    'cartoes-de-memoria':        'armazenamento',
    'brinquedos-educativos':     'jogos',
    'secretarias-retas':         'mobiliario',
    'secretarias-em-l':          'mobiliario',
    'secretarias-elevatorias':   'mobiliario',
    'ergonomicas':               'mobiliario',
    'executivas':                'mobiliario',
    'operacionais':              'mobiliario',
    'visitante':                 'mobiliario',
    'armarios-metalicos':        'mobiliario',
    'armarios-de-madeira':       'mobiliario',
    'gaveteiros':                'mobiliario',
    'cofres':                    'mobiliario',
    'mascaras':                  'epi',
    'oculos-de-protecao':        'epi',
    'capacetes':                 'epi',
    'vestuario-de-protecao':     'epi',
    // Mobiliário
    'cadeiras-de-escritorio':    'mobiliario',
    'secretarias':               'mobiliario',
    'armarios-e-gavetas':        'mobiliario',
    'mesas-de-reuniao':          'mobiliario',
    // Indústria
    'epi---protecao-individual': 'epi',
    'luvas':                     'epi',
    'embalagem':                 'industria',
    'fitas-adesivas':            'industria',
    'placas-de-sinalizacao':     'industria',
    'cones-e-barreiras':         'industria',
    'sacos-de-polietileno':      'industria',
    'sacos-de-lixo':             'higiene',
    'contentores-de-reciclagem': 'higiene',
    'spray-desinfetante':        'higiene',
    'sabao-liquido':             'higiene',
    'rolo-de-cozinha':           'higiene',
    // Jogos
    'jogos-de-mesa':             'jogos',
    'classicos':                 'jogos',
    'cooperativos':              'jogos',
    'familia':                   'jogos',
    'cartas':                    'jogos',
    'puzzles':                   'puzzles',
    '500-pecas':                 'puzzles',
    '1000-pecas':                'puzzles',
    'infantis':                  'puzzles',
    '3d':                        'puzzles',
    'matematica':                'jogos',
    'linguas':                   'jogos',
    'ciencias':                  'jogos',
    'musica':                    'jogos',
    'kits-de-arte':              'pinceis',
    'conjuntos-personalizaveis': 'canetas',
    'acessorios-de-atelier':      'pinceis',
    'apontadores':               'canetas',
    'arquivamento':              'mobiliario',
    'auriculares':               'armazenamento',
    'auxiliares':                'pintura',
    'bases-de-corte':            'mobiliario',
    'bisturis-e-x-atos':         'mobiliario',
    'borrachas':                 'canetas',
    'caixas-de-arquivo':         'mobiliario',
    'capas-de-transporte':       'mobiliario',
    'cavaletes-de-chao':         'pinceis',
    'cavaletes-e-atelier':       'pinceis',
    'colunas':                   'armazenamento',
    'conjuntos':                 'lapis',
    'corretores':                'canetas',
    'corte':                     'mobiliario',
    'desinfetantes':             'higiene',
    'dossiers':                  'mobiliario',
    'esferograficas-premium':    'canetas',
    'filme-estiravel':           'industria',
    'fixacao-e-corte':           'mobiliario',
    'headsets':                  'armazenamento',
    'home-office':               'mobiliario',
    'kits-e-conjuntos':          'cadernos',
    'malas-e-trolleys':          'mobiliario',
    'microfones':                'armazenamento',
    'mochilas':                  'mobiliario',
    'modulares':                 'mobiliario',
    'organizacao':               'mobiliario',
    'paletes':                   'pintura',
    'perifericos-e-acessorios':  'armazenamento',
    'pinceis-de-pelo':           'pinceis',
    'pranchetas':                'mobiliario',
    'ratos':                     'armazenamento',
    'redondas':                  'mobiliario',
    'reguas-e-esquadros':        'mobiliario',
    'retangulares':              'mobiliario',
    'scanners':                  'armazenamento',
    'separadores':               'mobiliario',
    'som':                       'armazenamento',
    'teclados':                  'armazenamento',
    'tinteiros':                 'impressoras',
    'toners':                    'impressoras',
    'transportar-e-guardar':     'mobiliario',
    'webcams':                   'armazenamento',
  };

  if (subMapping[subKey]) return FILTERS_BY_CATEGORY[subMapping[subKey]] ?? GENERIC_FILTERS;

  const aliasMapping: Array<[RegExp, string]> = [
    [/(?:\b|^)(?:caderno|bloco|nota|diario|agenda|agendas|planner|planners)s?(?:\b|$)/, 'cadernos'],
    [/(?:\b|^)(?:caneta|canetas|escrita|esferografica|gel|fineliner|rollerball|fonte|marcador|brushpen|pincel|luxo)(?:\b|$)/, 'canetas'],
    [/(?:\b|^)(?:lapis|grafite|carvao|pastel|aguarela|desenho)(?:\b|$)/, 'lapis'],
    [/(?:\b|^)(?:marcador|marcadores)(?:\b|$)/, 'marcadores'],
    [/(?:\b|^)(?:pintura|acrilica|oleo|guache|tinta)(?:\b|$)/, 'pintura'],
    [/(?:\b|^)(?:tela|telas|chassis)(?:\b|$)/, 'telas'],
    [/(?:\b|^)(?:papel|papeleira|papeleiras|post[-]?it|nota|notas|tissue|len[cç]o|len[cç]os|guardanapos|calendario|calendarios)(?:\b|$)/, 'papel'],
    [/(?:\b|^)(?:calculadora|calculadoras)(?:\b|$)/, 'calculadoras'],
    [/(?:\b|^)(?:impressora|impressoras|plotter|tinteiro|toner|consumiveis)(?:\b|$)/, 'impressoras'],
    [/(?:\b|^)(?:armazenamento|pens?|usb|cartao|cartoes|disco|discos)(?:\b|$)/, 'armazenamento'],
    [/(?:\b|^)(?:cadeira|cadeiras|secretaria|secretarias|mesa|mesas|armario|armarios|gaveta|gavetas|mobiliario|porta-canetas|porta-documentos|caixas-organizadoras|suportes-de-monitor|estojos|pastas-suspensas|guilhotinas|furadoras|agrafadores|tesouras)(?:\b|$)/, 'mobiliario'],
    [/(?:\b|^)(?:epi|protecao|luva|luvas|mascara|mascaras|oculos|capacete|capacetes|vestuario)(?:\b|$)/, 'epi'],
    [/(?:\b|^)(?:desinfetante|spray|sprays|sabao|sabonete|higiene|len[cç]o|guardanapos|rolo-de-cozinha|sacos|contentores)(?:\b|$)/, 'higiene'],
    [/(?:\b|^)(?:embalagem|fita|fitas|sinalizacao|placa|placas|cones|barreiras)(?:\b|$)/, 'industria'],
    [/(?:\b|^)(?:classico|classicos|cooperativo|cooperativos|familia|cartas)(?:\b|$)/, 'jogos'],
    [/(?:\b|^)(?:500-pecas|1000-pecas|3d|infantis)(?:\b|$)/, 'puzzles'],
    [/(?:\b|^)(?:matematica|linguas|ciencias|musica)(?:\b|$)/, 'jogos'],
  ];

  for (const [pattern, mapped] of aliasMapping) {
    if (pattern.test(subKey)) return FILTERS_BY_CATEGORY[mapped] ?? GENERIC_FILTERS;
  }

  // Mapeamento de categoria principal → filtros mais comuns
  const catMapping: Record<string, string> = {
    'artes':       'pintura',
    'escolar':     'cadernos',
    'escritorio':  'canetas',
    'informatica': 'impressoras',
    'mobiliario':  'mobiliario',
    'higiene':     'higiene',
    'industria':   'industria',
    'gifts':       'cadernos',
    'jogos':       'jogos',
  };

  const mapped = catMapping[catKey];
  if (mapped && FILTERS_BY_CATEGORY[mapped]) return FILTERS_BY_CATEGORY[mapped];

  return GENERIC_FILTERS;
}

/* ─────────────────────────────────────────
   PRICE RANGE SLIDER
   ───────────────────────────────────────── */
function PriceRange({
  min, max, unit, value, onChange,
}: {
  min: number; max: number; unit: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const pctLow  = ((value[0] - min) / (max - min)) * 100;
  const pctHigh = ((value[1] - min) / (max - min)) * 100;

  return (
    <div style={{ padding: '4px 0 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={S.priceLabel}>{unit}{value[0].toFixed(0)}</span>
        <span style={S.priceLabel}>{unit}{value[1].toFixed(0)}</span>
      </div>
      <div style={{ position: 'relative', height: 22 }}>
        <div style={S.track} />
        <div style={{ ...S.trackFill, left: `${pctLow}%`, width: `${pctHigh - pctLow}%` }} />
        <input type="range" min={min} max={max} value={value[0]} step={1}
          onChange={e => { const v = Number(e.target.value); if (v < value[1]) onChange([v, value[1]]); }}
          style={{ ...S.rangeInput, zIndex: value[0] > max - 10 ? 5 : 3 }}
          aria-label="Preço mínimo"
        />
        <input type="range" min={min} max={max} value={value[1]} step={1}
          onChange={e => { const v = Number(e.target.value); if (v > value[0]) onChange([value[0], v]); }}
          style={{ ...S.rangeInput, zIndex: 4 }}
          aria-label="Preço máximo"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   GRUPO DE FILTRO
   ───────────────────────────────────────── */
function FilterGroupPanel({
  group, isOpen, onToggleOpen,
  selected, rangeValue, onToggleOption, onRangeChange, compact,
}: {
  group: FilterGroup;
  isOpen: boolean;
  onToggleOpen: () => void;
  selected: string[];
  rangeValue: [number, number];
  onToggleOption: (val: string) => void;
  onRangeChange: (v: [number, number]) => void;
  compact?: boolean;
}) {
  return (
    <div style={S.groupWrap}>
      <button onClick={onToggleOpen} aria-expanded={isOpen} style={S.groupHeader}>
        <span style={S.groupLabel}>{group.label}</span>
        {selected.length > 0 && group.type !== 'range' && (
          <span style={S.groupCount}>{selected.length}</span>
        )}
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden
          style={{ flexShrink: 0, marginLeft: 'auto', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {isOpen && (
        <div style={{ padding: compact ? '6px 0 10px' : '6px 0 14px' }}>

          {group.type === 'range' && (
            <PriceRange min={group.min!} max={group.max!} unit={group.unit!}
              value={rangeValue} onChange={onRangeChange} />
          )}

          {group.type === 'checkbox' && group.options?.map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <div key={opt.value}
                role="checkbox" aria-checked={checked}
                tabIndex={0}
                onClick={() => onToggleOption(opt.value)}
                onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onToggleOption(opt.value)}
                style={S.checkRow}
              >
                <span style={{ ...S.checkbox, background: checked ? 'var(--red)' : 'transparent', borderColor: checked ? 'var(--red)' : 'var(--border)' }}>
                  {checked && (
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M2 6l3 3 5-5"/>
                    </svg>
                  )}
                </span>
                <span style={{ ...S.checkText, color: checked ? 'var(--text)' : 'var(--text-muted)', fontWeight: checked ? 500 : 400 }}>
                  {opt.label}
                </span>
              </div>
            );
          })}

          {group.type === 'color' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {group.options?.map(opt => {
                const checked = selected.includes(opt.value);
                return (
                  <button key={opt.value} title={opt.label}
                    aria-pressed={checked} aria-label={opt.label}
                    onClick={() => onToggleOption(opt.value)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: opt.color,
                      border: checked ? '2.5px solid var(--red)' : '2px solid var(--border)',
                      outline: checked ? '2.5px solid var(--red-border)' : 'none',
                      outlineOffset: 2,
                      cursor: 'pointer',
                      transition: 'transform .15s, outline .15s',
                      transform: checked ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                    }}
                  />
                );
              })}
            </div>
          )}

          {group.type === 'size' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
              {group.options?.map(opt => {
                const checked = selected.includes(opt.value);
                return (
                  <button key={opt.value}
                    aria-pressed={checked}
                    onClick={() => onToggleOption(opt.value)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: 6,
                      border: checked ? '1.5px solid var(--red)' : '1.5px solid var(--border)',
                      background: checked ? 'var(--red-muted)' : 'transparent',
                      color: checked ? 'var(--red)' : 'var(--text)',
                      fontFamily: "'DM Mono', 'Manrope', monospace",
                      fontSize: 11, fontWeight: checked ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all .15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   COMPONENTE PRINCIPAL
   ───────────────────────────────────────── */
export default function ProductFilters({ category, subcategory, onChange, compact = false }: ProductFiltersProps) {
  const { t } = useTranslation();
  const groups = resolveFilters(category, subcategory);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.id, g.defaultOpen ?? false]))
  );

  const toggleGroupOpen = useCallback((id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const initState = (): FilterState => {
    const s: FilterState = { price: [0, 500] };
    groups.forEach(g => {
      if (g.type === 'range') s.price = [g.min!, g.max!];
      else s[g.id] = [];
    });
    return s;
  };

  const [filters, setFilters] = useState<FilterState>(initState);

  const totalActive = Object.entries(filters).reduce((acc, [k, v]) =>
    k === 'price' ? acc : acc + (Array.isArray(v) ? v.length : 0), 0);

  const toggleOption = useCallback((groupId: string, value: string) => {
    const current = (filters[groupId] as string[]) ?? [];
    const next = current.includes(value) ? current.filter(x => x !== value) : [...current, value];
    const updated = { ...filters, [groupId]: next };
    setFilters(updated);
    onChange?.(updated);
  }, [filters, onChange]);

  const setRange = useCallback((v: [number, number]) => {
    const updated = { ...filters, price: v };
    setFilters(updated);
    onChange?.(updated);
  }, [filters, onChange]);

  const clearAll = () => { const f = initState(); setFilters(f); onChange?.(f); };

  const priceGroup = groups.find(g => g.type === 'range');

  return (
    <div style={{ ...S.root, ...(compact ? S.rootCompact : {}) }}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)"
            strokeWidth="2" strokeLinecap="round" aria-hidden>
            <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
          </svg>
          <span style={S.headerTitle}>{t('shop.shopFilters.filterTitle')}</span>
          {totalActive > 0 && <span style={S.badge}>{totalActive}</span>}
        </div>
        {totalActive > 0 && (
          <button onClick={clearAll} style={S.clearBtn} aria-label="Limpar todos os filtros">
            {t('shop.shopFilters.clearFilters')}
          </button>
        )}
      </div>

      <div style={compact ? { display: 'flex', flexWrap: 'wrap', gap: '0 2rem' } : {}}>
        {groups.map(group => {
          const sel = (filters[group.id] as string[]) ?? [];
          const rangeVal = filters.price as [number, number];
          const priceMin = priceGroup?.min ?? 0;
          const priceMax = priceGroup?.max ?? 500;
          return (
            <div key={group.id} style={compact ? { minWidth: 160, flex: '1 1 160px' } : {}}>
              <FilterGroupPanel
                group={group}
                isOpen={openGroups[group.id] ?? false}
                onToggleOpen={() => toggleGroupOpen(group.id)}
                selected={sel}
                rangeValue={group.type === 'range' ? rangeVal : [priceMin, priceMax]}
                onToggleOption={(val) => toggleOption(group.id, val)}
                onRangeChange={setRange}
                compact={compact}
              />
            </div>
          );
        })}
      </div>

      {totalActive > 0 && (
        <div style={S.tagsWrap} aria-label="Filtros activos">
          {Object.entries(filters).map(([groupId, values]) => {
            if (!Array.isArray(values) || values.length === 0) return null;
            const group = groups.find(g => g.id === groupId);
            return (values as string[]).map(val => {
              const opt = group?.options?.find(o => o.value === val);
              return (
                <button key={`${groupId}-${val}`}
                  onClick={() => toggleOption(groupId, val)}
                  style={S.tag}
                  aria-label={`Remover filtro ${opt?.label ?? val}`}>
                  {opt?.label ?? val}
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ marginLeft: 5 }} aria-hidden>
                    <path d="M2 2l8 8M10 2l-8 8"/>
                  </svg>
                </button>
              );
            });
          })}
        </div>
      )}

      <style>{`
        input[type='range'] {
          -webkit-appearance:none;appearance:none;
          background:transparent;width:100%;height:100%;
          position:absolute;top:0;left:0;margin:0;padding:0;pointer-events:none;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance:none;appearance:none;
          width:18px;height:18px;border-radius:50%;
          background:var(--surface);border:2.5px solid var(--red);
          cursor:pointer;pointer-events:all;
          box-shadow:0 2px 8px var(--red-border);
          transition:transform .15s;
        }
        input[type='range']::-webkit-slider-thumb:hover{transform:scale(1.25);}
        input[type='range']::-moz-range-thumb{
          width:18px;height:18px;border-radius:50%;
          background:var(--surface);border:2.5px solid var(--red);
          cursor:pointer;box-shadow:0 2px 8px var(--red-border);
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   ESTILOS
   ───────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  root:         { fontFamily:"'Manrope',sans-serif", color:'var(--text)' },
  rootCompact:  { background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, padding:'1rem 1.25rem', marginBottom:'1.5rem' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:12, marginBottom:4, borderBottom:'1.5px solid var(--border)' },
  headerTitle:  { fontFamily:"'Manrope',sans-serif", fontWeight:800, fontSize:14, letterSpacing:-.2, color:'var(--text)' },
  badge:        { background:'var(--red)', color:'#fff', fontFamily:"'Manrope',sans-serif", fontWeight:700, fontSize:10, padding:'2px 7px', borderRadius:99 },
  clearBtn:     { background:'transparent', border:'none', cursor:'pointer', fontFamily:"'Manrope',sans-serif", fontWeight:700, fontSize:11, letterSpacing:.5, textTransform:'uppercase' as const, color:'var(--red)', padding:'3px 0', textDecoration:'underline', textUnderlineOffset:3 },
  groupWrap:    { borderBottom:'1px solid var(--border)' },
  groupHeader:  { width:'100%', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', gap:8, color:'var(--text)' },
  groupLabel:   { fontFamily:"'Manrope',sans-serif", fontWeight:700, fontSize:11.5, letterSpacing:.6, textTransform:'uppercase' as const, color:'inherit' },
  groupCount:   { background:'var(--red-muted)', color:'var(--red)', fontFamily:"'Manrope',sans-serif", fontWeight:700, fontSize:9, padding:'1px 5px', borderRadius:99 },
  checkRow:     { display:'flex', alignItems:'center', gap:9, padding:'5px 0', cursor:'pointer', userSelect:'none' as const, transition:'opacity .15s' },
  checkbox:     { width:15, height:15, borderRadius:4, border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .15s,border-color .15s' },
  checkText:    { fontSize:13, lineHeight:1.3, transition:'color .15s,font-weight .15s' },
  priceLabel:   { fontFamily:"'Manrope',sans-serif", fontWeight:700, fontSize:13, color:'var(--red)' },
  track:        { position:'absolute', top:'50%', transform:'translateY(-50%)', left:0, right:0, height:4, background:'var(--border)', borderRadius:99 },
  trackFill:    { position:'absolute', top:'50%', transform:'translateY(-50%)', height:4, background:'var(--red)', borderRadius:99 },
  rangeInput:   { position:'absolute' },
  tagsWrap:     { display:'flex', flexWrap:'wrap', gap:6, paddingTop:12, borderTop:'1px solid var(--border)', marginTop:8 },
  tag:          { display:'inline-flex', alignItems:'center', padding:'4px 10px', background:'var(--red-muted)', border:'1px solid var(--red-border)', borderRadius:99, color:'var(--red)', fontFamily:"'Manrope',sans-serif", fontWeight:600, fontSize:11, cursor:'pointer', transition:'background .15s' },
};