-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: sistema_asistencia
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ambientes`
--

DROP TABLE IF EXISTS `ambientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ambientes` (
  `id_ambiente` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` int(11) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `capacidad` int(11) DEFAULT NULL,
  `tipo` varchar(50) DEFAULT NULL,
  `estado` varchar(30) DEFAULT NULL,
  `zona` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_ambiente`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ambientes`
--

LOCK TABLES `ambientes` WRITE;
/*!40000 ALTER TABLE `ambientes` DISABLE KEYS */;
INSERT INTO `ambientes` VALUES (1,501,'Ambiente ADSO',30,'Aula','Disponible',5),(2,102,'Laboratorio Sistemas',30,'Laboratorio','Disponible',1),(3,202,'Ambiente Multimedia',25,'Especializado','Ocupado',2),(4,304,'Desarrollo de Software',32,'Aula','Disponible',3),(5,404,'Ambiente Emprendimiento',32,'Aula','Disponible',4);
/*!40000 ALTER TABLE `ambientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `aprendices`
--

DROP TABLE IF EXISTS `aprendices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `aprendices` (
  `id_aprendiz` int(11) NOT NULL AUTO_INCREMENT,
  `documento` bigint(20) NOT NULL,
  `nombre` varchar(50) DEFAULT NULL,
  `apellido` varchar(50) DEFAULT NULL,
  `correo` varchar(100) DEFAULT NULL,
  `telefono` bigint(20) DEFAULT NULL,
  `id_ficha` int(11) NOT NULL,
  PRIMARY KEY (`id_aprendiz`),
  KEY `id_ficha` (`id_ficha`),
  CONSTRAINT `aprendices_ibfk_1` FOREIGN KEY (`id_ficha`) REFERENCES `fichas` (`id_ficha`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `aprendices`
--

LOCK TABLES `aprendices` WRITE;
/*!40000 ALTER TABLE `aprendices` DISABLE KEYS */;
INSERT INTO `aprendices` VALUES (1,100000001,'Aprendiz1_F1','SENA','aprendiz100000001@sena.edu.co',3000000001,1),(2,100000002,'Aprendiz2_F1','SENA','aprendiz100000002@sena.edu.co',3000000002,1),(3,100000003,'Aprendiz3_F1','SENA','aprendiz100000003@sena.edu.co',3000000003,1),(4,100000004,'Aprendiz4_F1','SENA','aprendiz100000004@sena.edu.co',3000000004,1),(5,100000005,'Aprendiz5_F1','SENA','aprendiz100000005@sena.edu.co',3000000005,1),(6,100000006,'Aprendiz6_F1','SENA','aprendiz100000006@sena.edu.co',3000000006,1),(7,100000007,'Aprendiz7_F1','SENA','aprendiz100000007@sena.edu.co',3000000007,1),(8,100000008,'Aprendiz8_F1','SENA','aprendiz100000008@sena.edu.co',3000000008,1),(9,100000009,'Aprendiz9_F1','SENA','aprendiz100000009@sena.edu.co',3000000009,1),(10,100000010,'Aprendiz10_F1','SENA','aprendiz100000010@sena.edu.co',3000000010,1),(11,100000011,'Aprendiz11_F1','SENA','aprendiz100000011@sena.edu.co',3000000011,1),(12,100000012,'Aprendiz12_F1','SENA','aprendiz100000012@sena.edu.co',3000000012,1),(13,100000013,'Aprendiz13_F1','SENA','aprendiz100000013@sena.edu.co',3000000013,1),(14,100000014,'Aprendiz14_F1','SENA','aprendiz100000014@sena.edu.co',3000000014,1),(15,100000015,'Aprendiz15_F1','SENA','aprendiz100000015@sena.edu.co',3000000015,1),(16,100000016,'Aprendiz16_F1','SENA','aprendiz100000016@sena.edu.co',3000000016,1),(17,100000017,'Aprendiz17_F1','SENA','aprendiz100000017@sena.edu.co',3000000017,1),(18,100000018,'Aprendiz18_F1','SENA','aprendiz100000018@sena.edu.co',3000000018,1),(19,100000019,'Aprendiz19_F1','SENA','aprendiz100000019@sena.edu.co',3000000019,1),(20,100000020,'Aprendiz1_F2','SENA','aprendiz100000020@sena.edu.co',3000000020,2),(21,100000021,'Aprendiz2_F2','SENA','aprendiz100000021@sena.edu.co',3000000021,2),(22,100000022,'Aprendiz3_F2','SENA','aprendiz100000022@sena.edu.co',3000000022,2),(23,100000023,'Aprendiz4_F2','SENA','aprendiz100000023@sena.edu.co',3000000023,2),(24,100000024,'Aprendiz5_F2','SENA','aprendiz100000024@sena.edu.co',3000000024,2),(25,100000025,'Aprendiz6_F2','SENA','aprendiz100000025@sena.edu.co',3000000025,2),(26,100000026,'Aprendiz7_F2','SENA','aprendiz100000026@sena.edu.co',3000000026,2),(27,100000027,'Aprendiz8_F2','SENA','aprendiz100000027@sena.edu.co',3000000027,2),(28,100000028,'Aprendiz9_F2','SENA','aprendiz100000028@sena.edu.co',3000000028,2),(29,100000029,'Aprendiz10_F2','SENA','aprendiz100000029@sena.edu.co',3000000029,2),(30,100000030,'Aprendiz11_F2','SENA','aprendiz100000030@sena.edu.co',3000000030,2),(31,100000031,'Aprendiz12_F2','SENA','aprendiz100000031@sena.edu.co',3000000031,2),(32,100000032,'Aprendiz13_F2','SENA','aprendiz100000032@sena.edu.co',3000000032,2),(33,100000033,'Aprendiz14_F2','SENA','aprendiz100000033@sena.edu.co',3000000033,2),(34,100000034,'Aprendiz15_F2','SENA','aprendiz100000034@sena.edu.co',3000000034,2),(35,100000035,'Aprendiz16_F2','SENA','aprendiz100000035@sena.edu.co',3000000035,2),(36,100000036,'Aprendiz17_F2','SENA','aprendiz100000036@sena.edu.co',3000000036,2),(37,100000037,'Aprendiz18_F2','SENA','aprendiz100000037@sena.edu.co',3000000037,2),(38,100000038,'Aprendiz19_F2','SENA','aprendiz100000038@sena.edu.co',3000000038,2),(39,100000039,'Aprendiz1_F3','SENA','aprendiz100000039@sena.edu.co',3000000039,3),(40,100000040,'Aprendiz2_F3','SENA','aprendiz100000040@sena.edu.co',3000000040,3),(41,100000041,'Aprendiz3_F3','SENA','aprendiz100000041@sena.edu.co',3000000041,3),(42,100000042,'Aprendiz4_F3','SENA','aprendiz100000042@sena.edu.co',3000000042,3),(43,100000043,'Aprendiz5_F3','SENA','aprendiz100000043@sena.edu.co',3000000043,3),(44,100000044,'Aprendiz6_F3','SENA','aprendiz100000044@sena.edu.co',3000000044,3),(45,100000045,'Aprendiz7_F3','SENA','aprendiz100000045@sena.edu.co',3000000045,3),(46,100000046,'Aprendiz8_F3','SENA','aprendiz100000046@sena.edu.co',3000000046,3),(47,100000047,'Aprendiz9_F3','SENA','aprendiz100000047@sena.edu.co',3000000047,3),(48,100000048,'Aprendiz10_F3','SENA','aprendiz100000048@sena.edu.co',3000000048,3),(49,100000049,'Aprendiz11_F3','SENA','aprendiz100000049@sena.edu.co',3000000049,3),(50,100000050,'Aprendiz12_F3','SENA','aprendiz100000050@sena.edu.co',3000000050,3),(51,100000051,'Aprendiz13_F3','SENA','aprendiz100000051@sena.edu.co',3000000051,3),(52,100000052,'Aprendiz14_F3','SENA','aprendiz100000052@sena.edu.co',3000000052,3),(53,100000053,'Aprendiz15_F3','SENA','aprendiz100000053@sena.edu.co',3000000053,3),(54,100000054,'Aprendiz16_F3','SENA','aprendiz100000054@sena.edu.co',3000000054,3),(55,100000055,'Aprendiz17_F3','SENA','aprendiz100000055@sena.edu.co',3000000055,3),(56,100000056,'Aprendiz18_F3','SENA','aprendiz100000056@sena.edu.co',3000000056,3),(57,100000057,'Aprendiz19_F3','SENA','aprendiz100000057@sena.edu.co',3000000057,3),(58,100000058,'Aprendiz1_F4','SENA','aprendiz100000058@sena.edu.co',3000000058,4),(59,100000059,'Aprendiz2_F4','SENA','aprendiz100000059@sena.edu.co',3000000059,4),(60,100000060,'Aprendiz3_F4','SENA','aprendiz100000060@sena.edu.co',3000000060,4),(61,100000061,'Aprendiz4_F4','SENA','aprendiz100000061@sena.edu.co',3000000061,4),(62,100000062,'Aprendiz5_F4','SENA','aprendiz100000062@sena.edu.co',3000000062,4),(63,100000063,'Aprendiz6_F4','SENA','aprendiz100000063@sena.edu.co',3000000063,4),(64,100000064,'Aprendiz7_F4','SENA','aprendiz100000064@sena.edu.co',3000000064,4),(65,100000065,'Aprendiz8_F4','SENA','aprendiz100000065@sena.edu.co',3000000065,4),(66,100000066,'Aprendiz9_F4','SENA','aprendiz100000066@sena.edu.co',3000000066,4),(67,100000067,'Aprendiz10_F4','SENA','aprendiz100000067@sena.edu.co',3000000067,4),(68,100000068,'Aprendiz11_F4','SENA','aprendiz100000068@sena.edu.co',3000000068,4),(69,100000069,'Aprendiz12_F4','SENA','aprendiz100000069@sena.edu.co',3000000069,4),(70,100000070,'Aprendiz13_F4','SENA','aprendiz100000070@sena.edu.co',3000000070,4),(71,100000071,'Aprendiz14_F4','SENA','aprendiz100000071@sena.edu.co',3000000071,4),(72,100000072,'Aprendiz15_F4','SENA','aprendiz100000072@sena.edu.co',3000000072,4),(73,100000073,'Aprendiz16_F4','SENA','aprendiz100000073@sena.edu.co',3000000073,4),(74,100000074,'Aprendiz17_F4','SENA','aprendiz100000074@sena.edu.co',3000000074,4),(75,100000075,'Aprendiz18_F4','SENA','aprendiz100000075@sena.edu.co',3000000075,4),(76,100000076,'Aprendiz19_F4','SENA','aprendiz100000076@sena.edu.co',3000000076,4);
/*!40000 ALTER TABLE `aprendices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asistencia`
--

DROP TABLE IF EXISTS `asistencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asistencia` (
  `id_asistencia` int(11) NOT NULL AUTO_INCREMENT,
  `fecha` date DEFAULT NULL,
  `estado` varchar(30) DEFAULT NULL,
  `observacion` varchar(200) DEFAULT NULL,
  `id_aprendiz` int(11) NOT NULL,
  `id_horario` int(11) NOT NULL,
  PRIMARY KEY (`id_asistencia`),
  KEY `id_aprendiz` (`id_aprendiz`),
  KEY `id_horario` (`id_horario`),
  CONSTRAINT `asistencia_ibfk_1` FOREIGN KEY (`id_aprendiz`) REFERENCES `aprendices` (`id_aprendiz`),
  CONSTRAINT `asistencia_ibfk_2` FOREIGN KEY (`id_horario`) REFERENCES `horarios` (`id_horario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencia`
--

LOCK TABLES `asistencia` WRITE;
/*!40000 ALTER TABLE `asistencia` DISABLE KEYS */;
/*!40000 ALTER TABLE `asistencia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fichas`
--

DROP TABLE IF EXISTS `fichas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fichas` (
  `id_ficha` int(11) NOT NULL AUTO_INCREMENT,
  `numero_ficha` int(11) NOT NULL,
  `jornada` varchar(30) NOT NULL,
  `modalidad` varchar(30) NOT NULL,
  `estado` varchar(20) NOT NULL,
  `id_programa` int(11) NOT NULL,
  `id_instructor` int(11) NOT NULL,
  PRIMARY KEY (`id_ficha`),
  KEY `id_programa` (`id_programa`),
  KEY `fk_ficha_instructor` (`id_instructor`),
  CONSTRAINT `fichas_ibfk_1` FOREIGN KEY (`id_programa`) REFERENCES `programas` (`id_programa`),
  CONSTRAINT `fk_ficha_instructor` FOREIGN KEY (`id_instructor`) REFERENCES `instructores` (`id_instructor`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fichas`
--

LOCK TABLES `fichas` WRITE;
/*!40000 ALTER TABLE `fichas` DISABLE KEYS */;
INSERT INTO `fichas` VALUES (1,3349882,'Mañana','Presencial','Activa',1,1),(2,3349883,'Mañana','Presencial','Activa',1,2),(3,3349884,'Mañana','Presencial','Activa',1,3),(4,3349885,'Mañana','Presencial','Activa',1,4),(9,3349886,'Mañana','Presencial','Activa',1,5),(10,3349887,'Mañana','Presencial','Activa',1,1),(11,3349888,'Mañana','Presencial','Activa',1,2),(12,3349889,'Mañana','Presencial','Activa',1,3);
/*!40000 ALTER TABLE `fichas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `horarios`
--

DROP TABLE IF EXISTS `horarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `horarios` (
  `id_horario` int(11) NOT NULL AUTO_INCREMENT,
  `dia` varchar(20) DEFAULT NULL,
  `hora_inicio` time DEFAULT NULL,
  `hora_fin` time DEFAULT NULL,
  `id_ficha` int(11) NOT NULL,
  `id_ambiente` int(11) NOT NULL,
  `id_instructor` int(11) NOT NULL,
  PRIMARY KEY (`id_horario`),
  KEY `id_ficha` (`id_ficha`),
  KEY `id_ambiente` (`id_ambiente`),
  KEY `id_instructor` (`id_instructor`),
  CONSTRAINT `horarios_ibfk_1` FOREIGN KEY (`id_ficha`) REFERENCES `fichas` (`id_ficha`),
  CONSTRAINT `horarios_ibfk_2` FOREIGN KEY (`id_ambiente`) REFERENCES `ambientes` (`id_ambiente`),
  CONSTRAINT `horarios_ibfk_3` FOREIGN KEY (`id_instructor`) REFERENCES `instructores` (`id_instructor`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `horarios`
--

LOCK TABLES `horarios` WRITE;
/*!40000 ALTER TABLE `horarios` DISABLE KEYS */;
INSERT INTO `horarios` VALUES (1,'Lunes','06:00:00','14:00:00',1,1,1),(2,'Martes','06:00:00','14:00:00',1,1,2),(3,'Miércoles','06:00:00','10:00:00',1,2,3),(4,'Miércoles','10:00:00','11:00:00',1,2,5),(5,'Jueves','06:00:00','14:00:00',1,2,2),(6,'Viernes','06:00:00','14:00:00',1,3,4);
/*!40000 ALTER TABLE `horarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `instructores`
--

DROP TABLE IF EXISTS `instructores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instructores` (
  `id_instructor` int(11) NOT NULL AUTO_INCREMENT,
  `documento` bigint(20) DEFAULT NULL,
  `nombre` varchar(60) DEFAULT NULL,
  `apellido` varchar(60) DEFAULT NULL,
  `correo` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id_instructor`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instructores`
--

LOCK TABLES `instructores` WRITE;
/*!40000 ALTER TABLE `instructores` DISABLE KEYS */;
INSERT INTO `instructores` VALUES (1,100000001,'Jorge','Raigosa','jorge.raigosa@sena.edu.co'),(2,100000002,'Yuly','Saenz','yuly.saenz@sena.edu.co'),(3,100000003,'Luis Fernando','Amarillo','luis.amarillo@sena.edu.co'),(4,100000004,'Jhoan Sebastian','Duque','jhoan.duque@sena.edu.co'),(5,100000005,'Eliana','Carmona','eliana.carmona@sena.edu.co');
/*!40000 ALTER TABLE `instructores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `programas`
--

DROP TABLE IF EXISTS `programas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `programas` (
  `id_programa` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `nivel` varchar(50) NOT NULL,
  `duracion` varchar(50) NOT NULL,
  `estado` varchar(20) NOT NULL,
  PRIMARY KEY (`id_programa`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `programas`
--

LOCK TABLES `programas` WRITE;
/*!40000 ALTER TABLE `programas` DISABLE KEYS */;
INSERT INTO `programas` VALUES (1,'Analisis y Desarrollo de Software','Tecnologo','27 Meses','Activo');
/*!40000 ALTER TABLE `programas` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-30 15:59:00
