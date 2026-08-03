/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'scoutfoto'
const SITE_URL = 'https://scoutfoto.app'

interface SecurityNewDeviceProps {
  name?: string
  device?: string
  browser?: string
  loginTime?: string
}

const SecurityNewDeviceEmail = ({ name, device, browser, loginTime }: SecurityNewDeviceProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>⚠️ Novo dispositivo detectado na sua conta {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={alertBanner}>
          <Text style={alertIcon}>🔒</Text>
          <Text style={alertText}>Alerta de Segurança</Text>
        </Section>

        <Heading style={h1}>
          {name ? `Olá, ${name}` : 'Olá'}
        </Heading>

        <Text style={text}>
          Detectamos um login na sua conta a partir de um <strong>novo dispositivo</strong>.
          Se foi você, pode ignorar esta mensagem.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Dispositivo</Text>
          <Text style={detailValue}>{device || 'Desconhecido'}</Text>
          <Text style={detailLabel}>Navegador</Text>
          <Text style={detailValue}>{browser || 'Desconhecido'}</Text>
          <Text style={detailLabel}>Data/Hora</Text>
          <Text style={detailValue}>{loginTime || new Date().toLocaleString('pt-BR')}</Text>
        </Section>

        <Text style={warningText}>
          ⚠️ Se <strong>não foi você</strong>, altere sua senha imediatamente para proteger sua conta.
        </Text>

        <Button style={button} href={`${SITE_URL}/profile`}>
          Alterar minha senha
        </Button>

        <Text style={footer}>
          Este é um alerta automático de segurança do {SITE_NAME}. Você recebe este e-mail
          porque um novo dispositivo acessou sua conta.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SecurityNewDeviceEmail,
  subject: '⚠️ Novo dispositivo detectado — ScoutFoto',
  displayName: 'Alerta: novo dispositivo',
  previewData: { name: 'Maria', device: 'Windows PC', browser: 'Chrome 120', loginTime: '01/04/2026 14:30' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const alertBanner = {
  backgroundColor: '#FEF3C7',
  borderRadius: '12px',
  padding: '12px 16px',
  marginBottom: '24px',
  textAlign: 'center' as const,
}
const alertIcon = { fontSize: '24px', margin: '0 0 4px', padding: '0' }
const alertText = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '14px',
  fontWeight: '600' as const,
  color: '#92400E',
  margin: '0',
  padding: '0',
}
const h1 = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#191F25',
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '14px',
  color: '#606B73',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const detailsBox = {
  backgroundColor: '#F9FAFB',
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  padding: '16px 20px',
  marginBottom: '20px',
}
const detailLabel = {
  fontSize: '11px',
  color: '#9CA3AF',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 2px',
  fontWeight: '600' as const,
}
const detailValue = {
  fontSize: '14px',
  color: '#191F25',
  margin: '0 0 12px',
  fontWeight: '500' as const,
}
const warningText = {
  fontSize: '14px',
  color: '#DC2626',
  lineHeight: '1.6',
  margin: '0 0 20px',
  fontWeight: '500' as const,
}
const button = {
  backgroundColor: '#DC2626',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
