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
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'scoutfoto'
const SITE_URL = 'https://scoutfoto.app'

interface WelcomeEmailProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo ao {SITE_NAME}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Bem-vindo, ${name}!` : 'Bem-vindo ao ScoutFoto!'}
        </Heading>
        <Text style={text}>
          Estamos felizes em ter você conosco! O ScoutFoto é a plataforma de
          gestão de fotos do seu grupo escoteiro — aqui você pode enviar,
          organizar e compartilhar as melhores memórias das atividades.
        </Text>
        <Text style={text}>
          Para começar, acesse seu painel e explore os recursos disponíveis:
        </Text>
        <Button style={button} href={`${SITE_URL}/dashboard`}>
          Acessar o Painel
        </Button>
        <Text style={footer}>
          Se tiver qualquer dúvida, entre em contato com a coordenação do seu
          grupo. Boas aventuras!
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Bem-vindo ao ScoutFoto!',
  displayName: 'E-mail de boas-vindas',
  previewData: { name: 'Maria' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#191F25',
  margin: '0 0 20px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '14px',
  color: '#606B73',
  lineHeight: '1.6',
  margin: '0 0 25px',
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
