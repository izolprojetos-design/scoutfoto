/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScoutFoto'
const SITE_URL = 'https://scoutfoto.app'

interface Props {
  nomeResponsavel?: string
  data?: string
  horario?: string
  local?: string
  tipo?: string
  ramo?: string
  assunto?: string
  emailSolicitante?: string
}

const SchedulingAdminNotificationEmail = ({
  nomeResponsavel,
  data,
  horario,
  local,
  tipo,
  ramo,
  assunto,
  emailSolicitante,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova solicitação de agendamento de {nomeResponsavel ?? 'um voluntário'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova solicitação de agendamento</Heading>
        <Text style={text}>
          Uma nova solicitação de agendamento foi registrada no <strong>{SITE_NAME}</strong> e aguarda análise.
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Detalhes da solicitação</Heading>
          {nomeResponsavel && <Text style={detail}><strong>Responsável:</strong> {nomeResponsavel}</Text>}
          {emailSolicitante && <Text style={detail}><strong>E-mail:</strong> {emailSolicitante}</Text>}
          {data && <Text style={detail}><strong>Data:</strong> {data}</Text>}
          {horario && <Text style={detail}><strong>Horário:</strong> {horario}</Text>}
          {local && <Text style={detail}><strong>Local:</strong> {local}</Text>}
          {ramo && <Text style={detail}><strong>Ramo:</strong> {ramo}</Text>}
          {tipo && <Text style={detail}><strong>Tipo:</strong> {tipo}</Text>}
          {assunto && <Text style={detail}><strong>Assunto:</strong> {assunto}</Text>}
        </Section>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={`${SITE_URL}/calendar`}>
            Ver no Calendário Escoteiro
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Atenciosamente,<br />
          Equipe {SITE_NAME} — 12º Grupo Escoteiro Monte Caburaí
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SchedulingAdminNotificationEmail,
  subject: (data: Record<string, any>) =>
    `Nova solicitação de agendamento — ${data.nomeResponsavel ?? 'ScoutFoto'}`,
  displayName: 'Notificação de Agendamento (Admin)',
  previewData: {
    nomeResponsavel: 'Maria Silva',
    emailSolicitante: 'maria@exemplo.com',
    data: '15/05/2026',
    horario: '14:00',
    local: 'Sede do Grupo',
    tipo: 'Reunião',
    ramo: '🐺 Lobinho',
    assunto: 'Reunião ordinária da Alcateia.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '600px' }
const h1 = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#191F25',
  margin: '0 0 20px',
  letterSpacing: '-0.02em',
}
const h2 = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#191F25',
  margin: '0 0 12px',
}
const text = {
  fontSize: '14px',
  color: '#606B73',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const card = {
  backgroundColor: '#F6F3ED',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '16px 0 24px',
  border: '1px solid #E5E0D5',
}
const detail = {
  fontSize: '13px',
  color: '#191F25',
  margin: '4px 0',
  lineHeight: '1.5',
}
const button = {
  backgroundColor: '#2B6E3F',
  color: '#F6F3ED',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#E5E0D5', margin: '28px 0 20px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0', lineHeight: '1.5' }
