/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScoutFoto'
const SITE_URL = 'https://scoutfoto.app'

interface SchedulingConfirmationProps {
  nomeResponsavel?: string
  data?: string
  horario?: string
  local?: string
  tipo?: string
  ramo?: string
  descricao?: string
  confirmUrl?: string
}

const SchedulingConfirmationEmail = ({
  nomeResponsavel,
  data,
  horario,
  local,
  tipo,
  ramo,
  descricao,
  confirmUrl,
}: SchedulingConfirmationProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme sua solicitação de agendamento no {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {nomeResponsavel ? `Olá, ${nomeResponsavel}!` : 'Olá!'}
        </Heading>
        <Text style={text}>
          Recebemos sua solicitação de agendamento no <strong>{SITE_NAME}</strong>.
          Para que ela seja analisada pela coordenação, é necessário confirmar
          que você é o(a) responsável por esta solicitação.
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Resumo da solicitação</Heading>
          {data && <Text style={detail}><strong>Data:</strong> {data}</Text>}
          {horario && <Text style={detail}><strong>Horário:</strong> {horario}</Text>}
          {local && <Text style={detail}><strong>Local:</strong> {local}</Text>}
          {ramo && <Text style={detail}><strong>Ramo:</strong> {ramo}</Text>}
          {tipo && <Text style={detail}><strong>Tipo:</strong> {tipo}</Text>}
          {descricao && <Text style={detail}><strong>Descrição:</strong> {descricao}</Text>}
        </Section>

        <Text style={text}>
          Clique no botão abaixo para confirmar a solicitação. O link é válido
          por <strong>72 horas</strong>.
        </Text>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={confirmUrl ?? `${SITE_URL}/confirmar-agendamento`}>
            Confirmar solicitação
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={smallText}>
          Se você não fez esta solicitação, basta ignorar este e-mail —
          nenhuma ação será tomada sem a sua confirmação.
        </Text>
        <Text style={smallText}>
          Caso o botão não funcione, copie e cole este link no navegador:
          <br />
          <span style={{ wordBreak: 'break-all', color: '#2B6E3F' }}>
            {confirmUrl ?? `${SITE_URL}/confirmar-agendamento`}
          </span>
        </Text>

        <Text style={footer}>
          Atenciosamente,<br />
          Equipe {SITE_NAME} — 12º Grupo Escoteiro Monte Caburaí
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SchedulingConfirmationEmail,
  subject: 'Confirme sua solicitação de agendamento — ScoutFoto',
  displayName: 'Confirmação de Agendamento',
  previewData: {
    nomeResponsavel: 'Maria Silva',
    data: '15/05/2026',
    horario: '14:00',
    local: 'Sede do Grupo',
    tipo: 'Reunião',
    ramo: '🐺 Lobinho',
    descricao: 'Reunião ordinária da Alcateia.',
    confirmUrl: 'https://scoutfoto.app/confirmar-agendamento?token=exemplo',
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
const smallText = {
  fontSize: '12px',
  color: '#8A949C',
  lineHeight: '1.5',
  margin: '0 0 12px',
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
