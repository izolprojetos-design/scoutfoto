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

interface SecurityAccountLockedProps {
  name?: string
  attempts?: number
  lockDuration?: string
}

const SecurityAccountLockedEmail = ({ name, attempts, lockDuration }: SecurityAccountLockedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>🚨 Sua conta {SITE_NAME} foi bloqueada temporariamente</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={alertBanner}>
          <Text style={alertIcon}>🚨</Text>
          <Text style={alertText}>Conta Bloqueada</Text>
        </Section>

        <Heading style={h1}>
          {name ? `Olá, ${name}` : 'Olá'}
        </Heading>

        <Text style={text}>
          Sua conta foi <strong>bloqueada temporariamente</strong> devido a múltiplas
          tentativas de login sem sucesso. Isso acontece para proteger sua conta
          contra acessos não autorizados.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Tentativas de login</Text>
          <Text style={detailValue}>{attempts || 5} tentativas falharam</Text>
          <Text style={detailLabel}>Duração do bloqueio</Text>
          <Text style={detailValue}>{lockDuration || '15 minutos'}</Text>
        </Section>

        <Text style={text}>
          Após o período de bloqueio, você poderá tentar fazer login novamente.
          Se não foi você quem tentou acessar a conta, recomendamos alterar sua senha.
        </Text>

        <Button style={button} href={`${SITE_URL}/forgot-password`}>
          Redefinir minha senha
        </Button>

        <Text style={footer}>
          Este é um alerta automático de segurança do {SITE_NAME}. Se você não
          reconhece essas tentativas de acesso, entre em contato com o administrador.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SecurityAccountLockedEmail,
  subject: '🚨 Conta bloqueada temporariamente — ScoutFoto',
  displayName: 'Alerta: conta bloqueada',
  previewData: { name: 'Maria', attempts: 5, lockDuration: '15 minutos' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const alertBanner = {
  backgroundColor: '#FEE2E2',
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
  color: '#991B1B',
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
  backgroundColor: '#FEF2F2',
  borderRadius: '12px',
  border: '1px solid #FECACA',
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
const button = {
  backgroundColor: '#2B6E3F',
  color: '#F6F3ED',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
