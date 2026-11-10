package com.shop.eurekaserver;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
class EurekaServerApplicationTests {

    @Autowired
    private Environment environment;

    @Test
    void startsAsStandaloneEurekaServer() {
        assertEquals("eureka-server", environment.getProperty("spring.application.name"));
        assertEquals("8761", environment.getProperty("server.port"));
        assertEquals("false", environment.getProperty("eureka.client.register-with-eureka"));
        assertEquals("false", environment.getProperty("eureka.client.fetch-registry"));
    }
}
