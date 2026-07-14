/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScoutFoto'
const SITE_URL = 'https://scoutfoto.app'

interface Props {
  level?: 'warn' | 'crit'
  resource?: string
  valueMb?: number
  thresholdMb?: number
  message?: string
}

const StorageAlertEmail = ({ level = 'warn', resource, valueMb, thresholdMb, message }: Props) => {
  const isCrit = level === 'crit'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{isCrit ? '🚨 Armazenamento crítico' : '⚠️ Atenção — armazenamento'} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...alertBanner, backgroundColor: isCrit ? '#FEE2E2' : '#FEF3C7' }}>
            <Text style={alertIcon}>{isCrit ? '🚨' : '⚠️'}</Text>
            <Text style={{ ...alertText, color: isCrit ? '#991B1B' : '#92400E' }}>
              {isCrit ? 'Alerta CRÍTICO de armazenamento' : 'Alerta de armazenamento'}
            </Text>
          </Section>

          <Heading style={h1}>{message || 'Uso de armazenamento acima do limite'}</Heading>

          <Section style={detailsBox}>
            <Text style={detailLabel}>Recurso</Text>
            <Text style={detailValue}>{resource || '—'}</Text>
            <Text style={detailLabel}>Uso atual</Text>
            <Text style={detailValue}>{valueMb?.toFixed(1) ?? '—'} MB</Text>
            <Text style={detailLabel}>Limite configurado</Text>
            <Text style={detailValue}>{thresholdMb?.toFixed(0) ?? '—'} MB</Text>
          </Section>

          <Text style={text}>
            Recomendamos revisar o painel administrativo para identificar buckets, tabelas
            ou usuários com maior consumo e tomar as ações necessárias.
          </Text>

          <Button style={{ ...button, backgroundColor: isCrit ? '#DC2626' : '#D97706' }} href={`${SITE_URL}/admin`}>
            Abrir painel administrativo
          </Button>

          <Text style={footer}>
            Alerta automático do {SITE_NAME}. Você recebe este e-mail porque é administrador do sistema.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: StorageAlertEmail,
  subject: (d: Record<string, any>) =>
    d?.level === 'crit'
      ? `🚨 CRÍTICO — ${d?.resource ?? 'Armazenamento'} — ScoutFoto`
      : `⚠️ Atenção — ${d?.resource ?? 'Armazenamento'} — ScoutFoto`,
  displayName: 'Alerta de armazenamento',
  previewData: { level: 'crit', resource: 'Storage total', valueMb: 920, thresholdMb: 900, message: 'Storage total atingiu nível CRÍTICO' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const alertBanner = { borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', textAlign: 'center' as const }
const alertIcon = { fontSize: '24px', margin: '0 0 4px', padding: '0' }
const alertText = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: '600' as const, margin: '0', padding: '0' }
const h1 = { fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 'bold' as const, color: '#191F25', margin: '0 0 16px', letterSpacing: '-0.02em' }
const text = { fontSize: '14px', color: '#606B73', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = { backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '16px 20px', marginBottom: '20px' }
const detailLabel = { fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px', fontWeight: '600' as const }
const detailValue = { fontSize: '14px', color: '#191F25', margin: '0 0 12px', fontWeight: '500' as const }
const button = { color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
